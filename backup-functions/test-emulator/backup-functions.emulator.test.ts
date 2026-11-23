// Emulator integration test (run in CI via `npm --prefix backup-functions run test:emulator` inside
// `firebase emulators:exec --project demo-...`). Runs the REAL exported scheduled functions through
// firebase-functions' own wrapper, writing run records to a real (emulated) Firestore through the
// real Admin SDK. All outbound HTTP is replaced by a fail-closed fetch mock and google-auth-library is
// mocked, so nothing can reach Google APIs or any real project.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const PROJECT = process.env.GCLOUD_PROJECT ?? "";
const BUCKET = "demo-backup-bucket";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("refusing to run without FIRESTORE_EMULATOR_HOST");
if (!PROJECT.startsWith("demo-")) throw new Error("refusing to run against a non-demo project id");
Object.assign(process.env, {
  GCLOUD_PROJECT: PROJECT,
  GOOGLE_CLOUD_PROJECT: PROJECT,
  GCP_DEPLOY_PROJECT_ID: PROJECT,
  PAGELOOM_BACKUP_BUCKET: BUCKET,
  PAGELOOM_FUNCTION_REGION: "europe-west1",
  PAGELOOM_BACKUP_SERVICE_ACCOUNT: "pageloom-backup@pageloom-os-production.iam.gserviceaccount.com",
  PAGELOOM_WORKERS_SERVICE_ACCOUNT: "pageloom-workers@pageloom-os-production.iam.gserviceaccount.com",
  AGENCY_TIMEZONE: "Asia/Jerusalem",
  PAGELOOM_MEDIA_TRANSFER_JOB: "transferJobs/demo",
  GOOGLE_APPLICATION_CREDENTIALS: "",
});

const authCalls: unknown[] = [];
vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    constructor(opts: unknown) { authCalls.push(opts); }
    async getAccessToken() { return "fake-token"; }
  },
}));
const logs: Array<{ level: string; event: string; meta: unknown }> = [];
vi.mock("firebase-functions/logger", async (orig) => {
  const real = await orig<typeof import("firebase-functions/logger")>();
  const rec = (level: string) => (event: string, meta?: unknown) => { logs.push({ level, event, meta }); };
  return { ...real, info: rec("info"), warn: rec("warn"), error: rec("error") };
});

type Route = (url: string, init?: RequestInit) => Response | undefined;
let routes: Route[] = [];
const requests: Array<{ url: string; init?: RequestInit }> = [];
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  requests.push({ url, ...(init ? { init } : {}) });
  for (const r of routes) { const res = r(url, init); if (res) return res; }
  throw new Error(`blocked unexpected network call: ${url}`);
}) as typeof fetch;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let fns: typeof import("../src/index.js");
let db: import("firebase-admin/firestore").Firestore;
beforeAll(async () => {
  fns = await import("../src/index.js");
  ({ db } = await import("../src/firebase.js"));
});
afterEach(() => { routes = []; requests.length = 0; logs.length = 0; authCalls.length = 0; });

const exportUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default):exportDocuments`;
async function runs() {
  const snap = await db.collection("systemOperations/backups/runs").get();
  return snap.docs.map((d) => d.data());
}
async function clearRuns() {
  const snap = await db.collection("systemOperations/backups/runs").get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}
const event = { scheduleTime: new Date().toISOString(), jobName: "test" } as never;

describe("dailyFirestoreBackup (real handler, emulator Firestore, mocked Google APIs)", () => {
  it("exposes a callable scheduled handler", () => {
    expect(typeof (fns.dailyFirestoreBackup as unknown as { run: unknown }).run).toBe("function");
  });

  it("starts an export of the configured project into the dated bucket prefix and records it", async () => {
    await clearRuns();
    routes = [(u) => (u === exportUrl ? json({ name: `projects/${PROJECT}/databases/(default)/operations/op-1` }) : undefined)];
    await (fns.dailyFirestoreBackup as unknown as { run: (e: unknown) => Promise<void> }).run(event);
    expect(requests).toHaveLength(1);
    const req = requests[0]!;
    expect(req.url).toBe(exportUrl);
    expect(req.init?.method).toBe("POST");
    expect((req.init?.headers as Record<string, string>).Authorization).toBe("Bearer fake-token");
    const body = JSON.parse(String(req.init?.body));
    expect(body.outputUriPrefix).toMatch(new RegExp(`^gs://${BUCKET}/firestore/\\d{4}-\\d{2}-\\d{2}$`));
    expect(authCalls[0]).toEqual({ scopes: ["https://www.googleapis.com/auth/datastore", "https://www.googleapis.com/auth/cloud-platform"] });
    const r = await runs();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ status: "started", operationName: `projects/${PROJECT}/databases/(default)/operations/op-1`, outputUriPrefix: body.outputUriPrefix });
    expect(logs.some((l) => l.level === "info" && l.event === "backup.started")).toBe(true);
  });

  it("records a duplicate 'path already exists' retry as already_completed without throwing", async () => {
    await clearRuns();
    routes = [(u) => (u === exportUrl ? json({ error: { message: "Path already exists: gs://x" } }, 409) : undefined)];
    await expect((fns.dailyFirestoreBackup as unknown as { run: (e: unknown) => Promise<void> }).run(event)).resolves.toBeUndefined();
    expect((await runs())[0]).toMatchObject({ status: "already_completed" });
    expect(logs.some((l) => l.event === "backup.already_completed")).toBe(true);
  });

  it("records a real failure and throws (so Cloud Scheduler retries)", async () => {
    await clearRuns();
    routes = [(u) => (u === exportUrl ? json({ error: { message: "Permission denied" } }, 403) : undefined)];
    await expect((fns.dailyFirestoreBackup as unknown as { run: (e: unknown) => Promise<void> }).run(event)).rejects.toThrow("Permission denied");
    expect((await runs())[0]).toMatchObject({ status: "failed", reason: "Permission denied" });
  });
});

describe("backupFreshnessWatchdog (real handler, mocked Google APIs)", () => {
  const run = () => (fns.backupFreshnessWatchdog as unknown as { run: (e: unknown) => Promise<void> }).run(event);
  function wire(latestFirestore: string, latestTransfer: string) {
    routes = [
      (u) => {
        if (!u.startsWith(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o`)) return undefined;
        const token = new URL(u).searchParams.get("pageToken");
        return token === "p2"
          ? json({ items: [{ name: "firestore/latest/latest.overall_export_metadata", timeCreated: latestFirestore }] })
          : json({ items: [{ name: "firestore/2020-01-01/2020-01-01.overall_export_metadata", timeCreated: "2020-01-01T00:00:00Z" }], nextPageToken: "p2" });
      },
      (u) => (u.startsWith("https://storagetransfer.googleapis.com/v1/transferOperations")
        ? json({ operations: [{ metadata: { status: "SUCCESS", endTime: latestTransfer } }, { metadata: { status: "FAILED", endTime: new Date().toISOString() } }] })
        : undefined),
      (u) => (u.startsWith(`https://servicehealth.googleapis.com/v1/projects/${PROJECT}/`) ? new Response("", { status: 404 }) : undefined),
    ];
  }

  it("follows pagination and reports healthy backups with only a heartbeat", async () => {
    const fresh = new Date(Date.now() - 2 * 3_600_000).toISOString();
    wire(fresh, fresh);
    await run();
    expect(requests.filter((r) => r.url.includes("pageToken=p2"))).toHaveLength(1);
    expect(logs.filter((l) => l.level !== "info")).toEqual([]);
    expect(logs.some((l) => l.event === "watchdog.heartbeat")).toBe(true);
  });

  it("raises errors when the Firestore and Storage backups are stale", async () => {
    const old = new Date(Date.now() - 300 * 3_600_000).toISOString();
    wire(old, old);
    await run();
    const errs = logs.filter((l) => l.level === "error").map((l) => l.event).sort();
    expect(errs).toEqual(["watchdog.firestore_backup_stale", "watchdog.storage_backup_stale"]);
  });
});
