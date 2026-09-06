import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeWatchdogLogEntries } from "./verify-watchdog-freshness.mjs";

test("finds a heartbeat and reports its timestamp", () => {
  const summary = summarizeWatchdogLogEntries([
    { log: 'watchdog.heartbeat {"checkedAt":"2026-09-05T00:00:00Z"}', time_utc: "2026-09-05 00:00:00" },
  ]);
  assert.equal(summary.heartbeatFound, true);
  assert.equal(summary.lastHeartbeat, "2026-09-05 00:00:00");
  assert.deepEqual(summary.concerningEvents, []);
});

test("reports no heartbeat found when the window has no matching entries", () => {
  const summary = summarizeWatchdogLogEntries([{ log: "some unrelated log line", time_utc: "2026-09-05 00:00:00" }]);
  assert.equal(summary.heartbeatFound, false);
});

test("reports no heartbeat found for an empty log window", () => {
  assert.equal(summarizeWatchdogLogEntries([]).heartbeatFound, false);
  assert.equal(summarizeWatchdogLogEntries(undefined).heartbeatFound, false);
});

test("surfaces stale/error/check-failed events separately from heartbeats", () => {
  const summary = summarizeWatchdogLogEntries([
    { log: 'watchdog.heartbeat {"checkedAt":"2026-09-05T00:00:00Z"}', time_utc: "2026-09-05 00:00:00" },
    { log: 'watchdog.firestore_backup_stale {"latestBackupDate":"2026-09-01T00:00:00Z"}', time_utc: "2026-09-05 00:00:00" },
    { log: 'watchdog.check_failed {"check":"storage"}', time_utc: "2026-09-05 00:00:00" },
  ]);
  assert.equal(summary.heartbeatFound, true);
  assert.equal(summary.concerningEvents.length, 2);
  assert.ok(summary.concerningEvents.some((e) => e.event === "watchdog.firestore_backup_stale"));
  assert.ok(summary.concerningEvents.some((e) => e.event === "watchdog.check_failed"));
});
