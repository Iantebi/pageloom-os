// H2 + the guards that used to live in functions/src/index.test.ts, now on the code that is deployed.
// Reads the real exported definitions (their deploy-time __endpoint manifest).
import { describe, expect, it } from "vitest";
import * as functions from "./index.js";
import { params } from "./config.js";

type Endpoint = { serviceAccountEmail?: unknown; availableMemoryMb?: unknown; scheduleTrigger?: { schedule?: unknown } };
const endpoints = Object.fromEntries(
  Object.entries(functions)
    .filter(([, value]) => value && typeof value === "function" && "__endpoint" in value)
    .map(([name, value]) => [name, (value as unknown as { __endpoint: Endpoint }).__endpoint]),
);
const defaultOf = (param: unknown) => (param as { options?: { default?: string } }).options?.default;

describe("deployed backup functions", () => {
  it("are exactly dailyFirestoreBackup and backupFreshnessWatchdog", () => {
    expect(Object.keys(endpoints).sort()).toEqual(["backupFreshnessWatchdog", "dailyFirestoreBackup"]);
  });
  it("run as their dedicated least-privilege service accounts (never compute/appspot)", () => {
    expect(endpoints.dailyFirestoreBackup?.serviceAccountEmail).toBe(params.backupServiceAccount);
    expect(endpoints.backupFreshnessWatchdog?.serviceAccountEmail).toBe(params.workersServiceAccount);
    expect(defaultOf(params.backupServiceAccount)).toBe("pageloom-backup@pageloom-os-production.iam.gserviceaccount.com");
    expect(defaultOf(params.workersServiceAccount)).toBe("pageloom-workers@pageloom-os-production.iam.gserviceaccount.com");
  });
  // 2026-09-02 incident: the watchdog crash-looped at the 256MiB default (see backup docs).
  it.each(["dailyFirestoreBackup", "backupFreshnessWatchdog"])("%s gets 512MiB", (name) => {
    expect(endpoints[name]?.availableMemoryMb).toBe(512);
  });
  it("schedules the watchdog every 6 hours and the backup daily at 02:30", () => {
    expect(endpoints.backupFreshnessWatchdog?.scheduleTrigger?.schedule).toBe("every 6 hours");
    expect(endpoints.dailyFirestoreBackup?.scheduleTrigger?.schedule).toBe("30 2 * * *");
  });
});
