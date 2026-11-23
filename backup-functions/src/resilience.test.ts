// Failure-mode tests for the two deployed backup functions. They run the REAL handlers with every
// external boundary mocked (Firestore via ./firebase.js, google-auth-library, the Functions logger,
// global fetch), so no network, credentials or emulator are involved. The goal is to prove each
// failure is (a) safe - never reported as a good backup - and (b) visible - it reaches a log entry
// that an existing alert policy watches (ERROR + the event names P1/P10 match on), or a thrown error
// that Cloud Scheduler retries and the scheduler-failure alerts (P1/P3) catch.
import { beforeEach, describe, expect, it, vi } from "vitest";

Object.assign(process.env, {
  GCP_DEPLOY_PROJECT_ID: "pageloom-test-project",
  PAGELOOM_BACKUP_BUCKET: "pageloom-test-backups",
  PAGELOOM_MEDIA_TRANSFER_JOB: "transferJobs/test",
});

const writes: Array<Record<string, unknown>> = [];
let failFirestoreWrites = false;
vi.mock("./firebase.js", () => ({
  db: {
    doc: () => ({
      set: async (data: Record<string, unknown>) => {
        if (failFirestoreWrites) throw Object.assign(new Error("14 UNAVAILABLE"), { code: 14 });
        writes.push(data);
      },
    }),
  },
}));
let token: string | null = "test-token";
vi.mock("google-auth-library", () => ({ GoogleAuth: class { async getAccessToken() { return token; } } }));
const logs: Array<{ level: string; event: string; meta: Record<string, unknown> }> = [];
vi.mock("firebase-functions/logger", () => {
  const rec = (level: string) => (event: string, meta: Record<string, unknown> = {}) => { logs.push({ level, event, meta }); };
  return { info: rec("info"), warn: rec("warn"), error: rec("error") };
});

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
let handler: Handler;
const calls: string[] = [];
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  calls.push(url);
  return handler(url, init);
}) as typeof fetch;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const netError = () => { throw new TypeError("fetch failed"); };

const { exportFirestoreBackup } = await import("./backup.js");
const { runBackupFreshnessWatchdog } = await import("./watchdog.js");
// Real back-off is 2s/4s; the retry COUNT and transient/permanent split are what is under test here.
(await import("./watchdog-policy.js")).transientRetryDefaults.delayMs = 0;

beforeEach(() => { writes.length = 0; logs.length = 0; calls.length = 0; failFirestoreWrites = false; token = "test-token"; });

const errorsOf = (event: string) => logs.filter((l) => l.level === "error" && l.event === event);

describe("dailyFirestoreBackup failure modes", () => {
  it("network failure: records a failed run with the reason and throws (Scheduler retries)", async () => {
    handler = netError;
    await expect(exportFirestoreBackup()).rejects.toThrow("Firestore export request failed: TypeError");
    expect(writes).toEqual([expect.objectContaining({ status: "failed", reason: "Firestore export request failed: TypeError" })]);
  });
  it("timeout: a hung request is aborted, recorded and thrown", async () => {
    handler = () => { throw Object.assign(new Error("aborted"), { name: "TimeoutError" }); };
    await expect(exportFirestoreBackup()).rejects.toThrow("TimeoutError");
    expect(writes[0]).toMatchObject({ status: "failed" });
  });
  it("missing permission (403): recorded as failed with Google's message and thrown", async () => {
    handler = () => json({ error: { message: "The caller does not have permission" } }, 403);
    await expect(exportFirestoreBackup()).rejects.toThrow("The caller does not have permission");
    expect(writes[0]).toMatchObject({ status: "failed", reason: "The caller does not have permission" });
  });
  it("non-JSON error body (e.g. a proxy's HTML 502): recorded as failed, not a parse crash", async () => {
    handler = () => new Response("<html>Bad Gateway</html>", { status: 502 });
    await expect(exportFirestoreBackup()).rejects.toThrow("Firestore export returned HTTP 502");
    expect(writes[0]).toMatchObject({ status: "failed", reason: "Firestore export returned HTTP 502" });
  });
  it("unexpected 200 payload without an operation name is a failure, never 'started'", async () => {
    handler = () => json({ unexpected: true });
    await expect(exportFirestoreBackup()).rejects.toThrow("HTTP 200");
    expect(writes.some((w) => w.status === "started")).toBe(false);
  });
  it("duplicate run / Scheduler retry after success: already_completed, not thrown, no overwrite", async () => {
    handler = () => json({ error: { message: "Path already exists: /pageloom-test-backups/firestore/2026-11-23" } }, 409);
    await expect(exportFirestoreBackup()).resolves.toBeUndefined();
    expect(writes[0]).toMatchObject({ status: "already_completed" });
    expect(calls).toHaveLength(1);
  });
  it("Firestore unavailable for the run record: the run throws (retried) instead of silently passing", async () => {
    handler = () => json({ name: "operations/op-1" });
    failFirestoreWrites = true;
    await expect(exportFirestoreBackup()).rejects.toThrow("UNAVAILABLE");
  });
  it("no access token: throws before calling any API", async () => {
    token = null;
    await expect(exportFirestoreBackup()).rejects.toThrow("Unable to acquire a Google access token");
    expect(calls).toHaveLength(0);
  });
  it("success: requests an unfiltered export of the configured project only", async () => {
    handler = (url, init) => {
      expect(url).toBe("https://firestore.googleapis.com/v1/projects/pageloom-test-project/databases/(default):exportDocuments");
      expect(JSON.parse(String(init?.body))).toEqual({ outputUriPrefix: expect.stringMatching(/^gs:\/\/pageloom-test-backups\/firestore\/\d{4}-\d{2}-\d{2}$/) });
      return json({ name: "operations/op-1" });
    };
    await exportFirestoreBackup();
    expect(writes[0]).toMatchObject({ status: "started", operationName: "operations/op-1" });
  });
});

describe("backupFreshnessWatchdog failure modes", () => {
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  const completed = (date: string, at: string) => [
    { name: `firestore/${date}/all_namespaces/all_kinds/output-0`, timeCreated: at },
    { name: `firestore/${date}/${date}.overall_export_metadata`, timeCreated: at },
  ];
  function wire({ gcs, transfer, health }: { gcs?: Handler; transfer?: Handler; health?: Handler }) {
    handler = (url, init) => {
      if (url.startsWith("https://storage.googleapis.com/")) return (gcs ?? (() => json({ items: completed("2026-11-23", hoursAgo(2)) })))(url, init);
      if (url.startsWith("https://storagetransfer.googleapis.com/")) return (transfer ?? (() => json({ operations: [{ metadata: { status: "SUCCESS", endTime: hoursAgo(24) } }] })))(url, init);
      if (url.startsWith("https://servicehealth.googleapis.com/")) return (health ?? (() => new Response("", { status: 404 })))(url, init);
      throw new Error(`unexpected URL ${url}`);
    };
  }

  it("healthy: no errors, heartbeat logged", async () => {
    wire({});
    await runBackupFreshnessWatchdog();
    expect(logs.filter((l) => l.level !== "info")).toEqual([]);
    expect(logs.at(-1)?.event).toBe("watchdog.heartbeat");
  });
  it("backup not performed (old completed export only): stale ERROR", async () => {
    wire({ gcs: () => json({ items: completed("2026-11-20", hoursAgo(60)) }) });
    await runBackupFreshnessWatchdog();
    expect(errorsOf("watchdog.firestore_backup_stale")).toHaveLength(1);
    expect(errorsOf("watchdog.firestore_backup_stale")[0]?.meta.hoursSinceLastBackup).toBe(60);
  });
  it("partial/failed export (fresh shards, no completion marker): judged by the last COMPLETED export", async () => {
    wire({ gcs: () => json({ items: [...completed("2026-11-21", hoursAgo(50)), { name: "firestore/2026-11-23/all_namespaces/all_kinds/output-0", timeCreated: hoursAgo(1) }] }) });
    await runBackupFreshnessWatchdog();
    expect(errorsOf("watchdog.firestore_backup_stale")).toHaveLength(1);
  });
  it("no completed export at all: fails closed with an ERROR", async () => {
    wire({ gcs: () => json({ items: [{ name: "firestore/2026-11-23/all_namespaces/all_kinds/output-0", timeCreated: hoursAgo(1) }] }) });
    await runBackupFreshnessWatchdog();
    expect(errorsOf("watchdog.firestore_backup_stale")[0]?.meta).toMatchObject({ reason: "no_completed_export_found" });
  });
  it("empty bucket listing: fails closed with an ERROR", async () => {
    wire({ gcs: () => json({}) });
    await runBackupFreshnessWatchdog();
    expect(errorsOf("watchdog.firestore_backup_stale")[0]?.meta).toMatchObject({ reason: "no_backup_objects_found" });
  });
  it("permission lost on the backup bucket (403): ERROR immediately, no retry, status recorded", async () => {
    wire({ gcs: () => json({ error: { code: 403, message: "denied" } }, 403) });
    await runBackupFreshnessWatchdog();
    expect(errorsOf("watchdog.firestore_backup_stale")[0]?.meta).toMatchObject({ reason: "check_failed", errorName: "HttpStatusError", httpStatus: 403 });
    expect(calls.filter((u) => u.startsWith("https://storage.googleapis.com/"))).toHaveLength(1);
  });
  it("backup bucket unavailable (404): ERROR", async () => {
    wire({ gcs: () => json({ error: { code: 404 } }, 404) });
    await runBackupFreshnessWatchdog();
    expect(errorsOf("watchdog.firestore_backup_stale")[0]?.meta).toMatchObject({ httpStatus: 404 });
  });
  it("temporary blip (503 then OK): retried within the run, no false alert", async () => {
    let n = 0;
    wire({ gcs: () => (++n === 1 ? json({}, 503) : json({ items: completed("2026-11-23", hoursAgo(2)) })) });
    await runBackupFreshnessWatchdog();
    expect(n).toBe(2);
    expect(logs.filter((l) => l.level === "error")).toEqual([]);
  });
  it("persistent network failure: retried 3 times, then ERROR (not a silent warning)", async () => {
    wire({ gcs: netError });
    await runBackupFreshnessWatchdog();
    expect(calls.filter((u) => u.startsWith("https://storage.googleapis.com/"))).toHaveLength(3);
    expect(errorsOf("watchdog.firestore_backup_stale")[0]?.meta).toMatchObject({ reason: "check_failed", errorName: "TypeError" });
  });
  it("malformed API data (wrong types / missing fields): no crash, fails closed", async () => {
    wire({ gcs: () => json({ items: [{ name: 42 }, null, { timeCreated: "not-a-date" }].filter(Boolean) }) });
    await runBackupFreshnessWatchdog();
    expect(errorsOf("watchdog.firestore_backup_stale")).toHaveLength(1);
    expect(logs.at(-1)?.event).toBe("watchdog.heartbeat");
  });
  it("very large listings: pagination is bounded (no endless loop)", async () => {
    let pages = 0;
    wire({ gcs: () => { pages += 1; return json({ items: completed("2026-11-23", hoursAgo(2)), nextPageToken: `p${pages}` }); } });
    await runBackupFreshnessWatchdog();
    expect(pages).toBe(50);
  });
  it("Storage Transfer API permission error: storage stale ERROR", async () => {
    wire({ transfer: () => json({ error: { code: 403 } }, 403) });
    await runBackupFreshnessWatchdog();
    expect(errorsOf("watchdog.storage_backup_stale")[0]?.meta).toMatchObject({ reason: "check_failed", httpStatus: 403 });
  });
  it("Storage Transfer with only failed runs: storage stale ERROR", async () => {
    wire({ transfer: () => json({ operations: [{ metadata: { status: "FAILED", endTime: hoursAgo(1) } }] }) });
    await runBackupFreshnessWatchdog();
    expect(errorsOf("watchdog.storage_backup_stale")[0]?.meta).toMatchObject({ reason: "no_successful_operations_found" });
  });
  it("credentials unavailable: both checks fail closed, heartbeat still sent", async () => {
    token = null;
    wire({});
    await runBackupFreshnessWatchdog();
    expect(errorsOf("watchdog.firestore_backup_stale")).toHaveLength(1);
    expect(errorsOf("watchdog.storage_backup_stale")).toHaveLength(1);
    expect(logs.at(-1)?.event).toBe("watchdog.heartbeat");
  });
  it("one alert per problem per run, and no token or secret in any log", async () => {
    wire({ gcs: () => json({}, 403), transfer: () => json({}, 403) });
    await runBackupFreshnessWatchdog();
    expect(errorsOf("watchdog.firestore_backup_stale")).toHaveLength(1);
    expect(errorsOf("watchdog.storage_backup_stale")).toHaveLength(1);
    expect(JSON.stringify(logs)).not.toContain("test-token");
  });
});
