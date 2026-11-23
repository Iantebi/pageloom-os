import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateScheduledBackup } from "./scheduled-backup.mjs";

const SA = "pageloom-backup@pageloom-os-production.iam.gserviceaccount.com";
const OP = "projects/p/databases/(default)/operations/op-1";
function good(over = {}) {
  return {
    day: "2026-11-24", backupSa: SA,
    audit: { principal: SA, authorizationInfo: [{ permission: "datastore.databases.export", granted: true }] },
    exportOp: { name: OP, state: "SUCCESSFUL", outputUriPrefix: "gs://b/firestore/2026-11-24", documents: "1230", endTime: "2026-11-24T00:31:00Z" },
    runRecord: { status: "started", operationName: OP },
    completionMarker: true,
    watchdogEntries: [{ timestamp: "2026-11-24T02:52:00Z", severity: "INFO", message: "watchdog.heartbeat" }],
    now: "2026-11-24T03:00:00Z",
    ...over,
  };
}

test("a real scheduled run with granted permission, successful export, marker and clean heartbeat passes", () => {
  const r = evaluateScheduledBackup(good());
  assert.equal(r.verdict, "PASS", r.reasons.join("; "));
});

test("already_completed (a duplicate/manual run) is never accepted as proof", () => {
  const r = evaluateScheduledBackup(good({ runRecord: { status: "already_completed" } }));
  assert.equal(r.verdict, "FAIL");
  assert.match(r.reasons.join(), /must start a new export/);
});

test("permission not granted, missing check, wrong caller or API error all fail", () => {
  assert.equal(evaluateScheduledBackup(good({ audit: { principal: SA, authorizationInfo: [{ permission: "datastore.databases.export", granted: false }] } })).verdict, "FAIL");
  assert.equal(evaluateScheduledBackup(good({ audit: { principal: SA, authorizationInfo: [] } })).verdict, "FAIL");
  assert.equal(evaluateScheduledBackup(good({ audit: { principal: "someone@else", authorizationInfo: [{ permission: "datastore.databases.export", granted: true }] } })).verdict, "FAIL");
  assert.equal(evaluateScheduledBackup(good({ audit: { principal: SA, authorizationInfo: [{ permission: "datastore.databases.export", granted: true }], statusCode: 7, statusMessage: "denied" } })).verdict, "FAIL");
  assert.equal(evaluateScheduledBackup(good({ audit: null })).verdict, "FAIL");
});

test("export not successful, empty, elsewhere or missing fails", () => {
  for (const exportOp of [null, { name: OP, state: "PROCESSING", outputUriPrefix: "gs://b/firestore/2026-11-24", documents: "10", endTime: "2026-11-24T00:31:00Z" },
    { name: OP, state: "SUCCESSFUL", outputUriPrefix: "gs://b/firestore/2026-11-24", documents: "0", endTime: "2026-11-24T00:31:00Z" },
    { name: OP, state: "SUCCESSFUL", outputUriPrefix: "gs://b/firestore/2026-11-23", documents: "5", endTime: "2026-11-24T00:31:00Z" }]) {
    assert.equal(evaluateScheduledBackup(good({ exportOp })).verdict, "FAIL");
  }
});

test("no completion marker (partial export) fails", () => {
  assert.equal(evaluateScheduledBackup(good({ completionMarker: false })).verdict, "FAIL");
});

test("run record for a different operation fails", () => {
  assert.equal(evaluateScheduledBackup(good({ runRecord: { status: "started", operationName: "other" } })).verdict, "FAIL");
});

test("watchdog error after the export fails; errors before it are ignored", () => {
  const err = { timestamp: "2026-11-24T02:52:00Z", severity: "ERROR", message: "watchdog.firestore_backup_stale" };
  assert.equal(evaluateScheduledBackup(good({ watchdogEntries: [err] })).verdict, "FAIL");
  const before = { ...err, timestamp: "2026-11-23T20:52:00Z" };
  assert.equal(evaluateScheduledBackup(good({ watchdogEntries: [before, ...good().watchdogEntries] })).verdict, "PASS");
});

test("no heartbeat yet: PENDING within 7h of the export, FAIL after", () => {
  assert.equal(evaluateScheduledBackup(good({ watchdogEntries: [], now: "2026-11-24T02:00:00Z" })).verdict, "PENDING");
  assert.equal(evaluateScheduledBackup(good({ watchdogEntries: [], now: "2026-11-24T09:00:00Z" })).verdict, "FAIL");
});
