import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeFirestoreExports } from "./verify-firestore-backup.mjs";

test("reports fresh when the latest export object is recent", () => {
  const now = new Date("2026-09-05T00:00:00Z");
  const summary = summarizeFirestoreExports([{ timeCreated: "2026-09-04T02:30:00Z" }], now);
  assert.equal(summary.status, "fresh");
  assert.equal(summary.objectCount, 1);
});

test("reports STALE when the latest export object is past the 27h threshold", () => {
  const now = new Date("2026-09-05T00:00:00Z");
  const summary = summarizeFirestoreExports([{ timeCreated: "2026-09-01T00:00:00Z" }], now);
  assert.equal(summary.status, "STALE");
});

test("reports unknown when no export objects were found", () => {
  const summary = summarizeFirestoreExports([], new Date());
  assert.equal(summary.status, "unknown");
  assert.equal(summary.objectCount, 0);
});

test("picks the most recent object out of several, regardless of list order", () => {
  const now = new Date("2026-09-05T00:00:00Z");
  const summary = summarizeFirestoreExports(
    [{ timeCreated: "2026-09-02T00:00:00Z" }, { timeCreated: "2026-09-04T02:30:00Z" }, { timeCreated: "2026-09-01T00:00:00Z" }],
    now,
  );
  assert.equal(summary.latest, new Date("2026-09-04T02:30:00Z").toISOString());
});
