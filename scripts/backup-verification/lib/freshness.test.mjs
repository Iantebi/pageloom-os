import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FIRESTORE_FRESHNESS_HOURS,
  STORAGE_FRESHNESS_HOURS,
  isFirestoreBackupStale,
  isStorageBackupStale,
  latestTimestamp,
  summarizeFreshness,
} from "./freshness.mjs";

test("Firestore freshness: fresh well within the 27h window", () => {
  const now = new Date("2026-09-01T10:00:00Z");
  assert.equal(isFirestoreBackupStale(now, new Date("2026-09-01T00:00:00Z")), false);
});

test("Firestore freshness: stale one second past the 27h boundary", () => {
  const now = new Date("2026-09-01T03:00:01Z");
  const latest = new Date(now.getTime() - FIRESTORE_FRESHNESS_HOURS * 3_600_000 - 1000);
  assert.equal(isFirestoreBackupStale(now, latest), true);
});

test("Storage freshness: fresh well within the 204h window", () => {
  const now = new Date("2026-09-05T00:00:00Z");
  assert.equal(isStorageBackupStale(now, new Date("2026-09-01T00:00:00Z")), false);
});

test("Storage freshness: stale one second past the 204h boundary", () => {
  const now = new Date("2026-09-09T00:00:01Z");
  const lastSuccess = new Date(now.getTime() - STORAGE_FRESHNESS_HOURS * 3_600_000 - 1000);
  assert.equal(isStorageBackupStale(now, lastSuccess), true);
});

test("latestTimestamp picks the most recent value, not list order", () => {
  assert.deepEqual(
    latestTimestamp(["2026-08-28T23:30:00Z", "2026-08-30T23:30:00Z", "2026-08-29T23:30:00Z"]),
    new Date("2026-08-30T23:30:00Z"),
  );
});

test("latestTimestamp returns null when there are no timestamps", () => {
  assert.equal(latestTimestamp([]), null);
  assert.equal(latestTimestamp([undefined, undefined]), null);
});

test("summarizeFreshness reports unknown when nothing was found", () => {
  const summary = summarizeFreshness({ label: "firestore-export", now: new Date(), latest: null, staleCheck: isFirestoreBackupStale, thresholdHours: FIRESTORE_FRESHNESS_HOURS });
  assert.equal(summary.status, "unknown");
});

test("summarizeFreshness reports fresh/STALE correctly", () => {
  const now = new Date("2026-09-05T00:00:00Z");
  const fresh = summarizeFreshness({ label: "firestore-export", now, latest: new Date("2026-09-04T12:00:00Z"), staleCheck: isFirestoreBackupStale, thresholdHours: FIRESTORE_FRESHNESS_HOURS });
  assert.equal(fresh.status, "fresh");
  const stale = summarizeFreshness({ label: "firestore-export", now, latest: new Date("2026-08-20T00:00:00Z"), staleCheck: isFirestoreBackupStale, thresholdHours: FIRESTORE_FRESHNESS_HOURS });
  assert.equal(stale.status, "STALE");
});
