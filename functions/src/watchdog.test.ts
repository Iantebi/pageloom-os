import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The watchdog previously only wrote to Cloud Logging (operationalLog), which nobody sees unless
// they are actively tailing logs. It now also persists every warning/error signal to Firestore so
// /platform/system-health (platform-master-api.ts) can surface them in-app - see recordAlert below.
const source = readFileSync(new URL("./watchdog.ts", import.meta.url), "utf8");

describe("backup/service-health watchdog persistence", () => {
  it("persists every stale-backup and incident signal as an actionable alert, not just a log line", () => {
    for (const call of [
      'recordAlert("firestore_backup_stale", "error"',
      'recordAlert("storage_backup_stale", "error"',
      'recordAlert("service_health_incident", "error"',
    ]) {
      expect(source).toContain(call);
    }
  });

  it("persists check failures too, so a broken credential or unreachable API is never silent", () => {
    for (const call of [
      'recordAlert("firestore_check_failed", "warning"',
      'recordAlert("storage_check_failed", "warning"',
      'recordAlert("service_health_check_failed", "warning"',
    ]) {
      expect(source).toContain(call);
    }
  });

  it("writes alerts to the collection the system-health endpoint reads", () => {
    expect(source).toContain('db.collection("systemOperations/watchdog/alerts")');
  });

  it("records a heartbeat so a stopped schedule is itself detectable, not just a healthy-looking silence", () => {
    expect(source).toContain('db.doc("systemOperations/watchdogHeartbeat")');
    const heartbeatIndex = source.indexOf('db.doc("systemOperations/watchdogHeartbeat")');
    const runIndex = source.indexOf("export async function runBackupFreshnessWatchdog");
    expect(heartbeatIndex).toBeGreaterThan(runIndex);
  });

  it("never lets a Firestore write failure inside recordAlert or the heartbeat write crash the schedule", () => {
    // Monitoring must not become a new failure point: if the alert/heartbeat write itself throws
    // (e.g. Firestore is briefly unavailable), it should be logged and swallowed right there rather
    // than propagate out and stop the remaining checks (or the heartbeat) from running.
    const recordAlertBody = source.slice(source.indexOf("async function recordAlert"), source.indexOf("async function accessToken"));
    expect(recordAlertBody).toContain("try {");
    expect(recordAlertBody).toContain("watchdog.alert_write_failed");
    const heartbeatWrite = source.slice(source.indexOf("await db.doc(\"systemOperations/watchdogHeartbeat\")") - 100);
    expect(heartbeatWrite).toContain("watchdog.heartbeat_write_failed");
  });
});
