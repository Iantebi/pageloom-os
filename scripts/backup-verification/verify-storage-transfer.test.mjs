import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeTransferOperations } from "./verify-storage-transfer.mjs";

test("reports fresh when the latest SUCCESS operation is recent", () => {
  const now = new Date("2026-09-05T00:00:00Z");
  const summary = summarizeTransferOperations([{ metadata: { status: "SUCCESS", endTime: "2026-09-01T03:00:00Z" } }], now);
  assert.equal(summary.status, "fresh");
  assert.equal(summary.successCount, 1);
});

test("reports STALE when the latest SUCCESS operation is past the 204h threshold", () => {
  const now = new Date("2026-09-15T00:00:00Z");
  const summary = summarizeTransferOperations([{ metadata: { status: "SUCCESS", endTime: "2026-09-01T00:00:00Z" } }], now);
  assert.equal(summary.status, "STALE");
});

test("ignores FAILED operations when picking the latest success", () => {
  const now = new Date("2026-09-05T00:00:00Z");
  const summary = summarizeTransferOperations(
    [
      { metadata: { status: "FAILED", endTime: "2026-09-04T23:00:00Z" } },
      { metadata: { status: "SUCCESS", endTime: "2026-09-01T03:00:00Z" } },
    ],
    now,
  );
  assert.equal(summary.latest, new Date("2026-09-01T03:00:00Z").toISOString());
  assert.equal(summary.operationCount, 2);
  assert.equal(summary.successCount, 1);
});

test("reports unknown when no successful operations were found", () => {
  const summary = summarizeTransferOperations([], new Date());
  assert.equal(summary.status, "unknown");
});
