import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("scheduled function memory allocation", () => {
  // The default 256MiB allocation was observed exceeding its limit in production logs for
  // monitorBusinessRisks, monitorWorkflowTimeouts, and dailyCeoReport (Cloud Run kills the
  // instance and Cloud Scheduler retries, producing noisy failures with no functional bug).
  // 512MiB mirrors the already-verified fix for monitorBusinessRisks.
  it("gives monitorBusinessRisks 512MiB", () => {
    expect(indexSource).toMatch(/monitorBusinessRisks=onSchedule\(\{[^}]*memory:"512MiB"/);
  });
  it("gives monitorWorkflowTimeouts 512MiB", () => {
    expect(indexSource).toMatch(/monitorWorkflowTimeouts=onSchedule\(\{[^}]*memory:"512MiB"/);
  });
  it("gives dailyCeoReport 512MiB", () => {
    expect(indexSource).toMatch(/dailyCeoReport=onSchedule\(\{[^}]*memory:"512MiB"/);
  });
  // 2026-09-02 production incident: backupFreshnessWatchdog crash-looped on every scheduled
  // invocation that day (confirmed via Cloud Logging: 256-266MiB used against the 256MiB
  // default on every attempt, zero successful watchdog.heartbeat logs in the preceding 14
  // days) and dailyFirestoreBackup was observed with the same near-zero headroom historically,
  // even though its most recent run happened to complete. Same fix as the three functions
  // above, applied to the two backup-reliability functions that were missed.
  it("gives backupFreshnessWatchdog 512MiB", () => {
    expect(indexSource).toMatch(/backupFreshnessWatchdog=onSchedule\(\{[^}]*memory:"512MiB"/);
  });
  it("gives dailyFirestoreBackup 512MiB", () => {
    expect(indexSource).toMatch(/dailyFirestoreBackup=onSchedule\(\{[^}]*memory:"512MiB"/);
  });
});

describe("backup freshness watchdog wiring", () => {
  it("schedules backupFreshnessWatchdog every 6 hours", () => {
    expect(indexSource).toMatch(/backupFreshnessWatchdog=onSchedule\(\{schedule:"every 6 hours"/);
  });
});

describe("backup subsystem is isolated from the live application (issue #36)", () => {
  // Firebase Functions v2 deploys every exported function as its own independent Cloud Run
  // service - a crash or timeout in one export cannot take down another. That isolation only
  // holds as long as dailyFirestoreBackup/backupFreshnessWatchdog stay their own onSchedule
  // exports and are never called from within the `api` onRequest handler that serves
  // /dashboard, /crm, /projects, and the customer portal. These guards catch a future change
  // that would accidentally wire backup/watchdog logic into that shared request path.
  it("declares dailyFirestoreBackup and backupFreshnessWatchdog as their own top-level onSchedule exports", () => {
    expect(indexSource).toMatch(/export const dailyFirestoreBackup\s*=\s*onSchedule\(/);
    expect(indexSource).toMatch(/export const backupFreshnessWatchdog\s*=\s*onSchedule\(/);
  });
  it("never invokes exportFirestoreBackup or runBackupFreshnessWatchdog from inside the api onRequest handler", () => {
    const apiExportLine = indexSource.split("\n").find((line) => line.includes("export const api=onRequest"));
    expect(apiExportLine).toBeDefined();
    expect(apiExportLine).not.toContain("exportFirestoreBackup");
    expect(apiExportLine).not.toContain("runBackupFreshnessWatchdog");
  });
  it("the api Express app (api.ts) never imports the backup or watchdog modules", () => {
    const apiSource = readFileSync(new URL("./api.ts", import.meta.url), "utf8");
    expect(apiSource).not.toMatch(/from\s*["']\.\/backup\.js["']/);
    expect(apiSource).not.toMatch(/from\s*["']\.\/watchdog\.js["']/);
  });
});
