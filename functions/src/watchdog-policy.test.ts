import { describe, expect, it } from "vitest";
import {
  FIRESTORE_FRESHNESS_HOURS,
  STORAGE_FRESHNESS_HOURS,
  isFirestoreBackupStale,
  isStorageBackupStale,
  latestTimestamp,
  isRelevantActiveServiceHealthEvent,
} from "./watchdog-policy.js";

describe("Firestore backup freshness", () => {
  it("is fresh well within the 27h window", () => {
    const now = new Date("2026-09-01T10:00:00Z");
    expect(isFirestoreBackupStale(now, new Date("2026-09-01T00:00:00Z"))).toBe(false);
  });
  it("is fresh exactly at the 27h boundary", () => {
    const now = new Date("2026-09-01T03:00:00Z");
    const latest = new Date(now.getTime() - FIRESTORE_FRESHNESS_HOURS * 3_600_000);
    expect(isFirestoreBackupStale(now, latest)).toBe(false);
  });
  it("is stale one second past the 27h boundary", () => {
    const now = new Date("2026-09-01T03:00:01Z");
    const latest = new Date(now.getTime() - FIRESTORE_FRESHNESS_HOURS * 3_600_000 - 1000);
    expect(isFirestoreBackupStale(now, latest)).toBe(true);
  });
});

describe("Storage transfer backup freshness", () => {
  it("is fresh well within the 204h (8.5 day) window", () => {
    const now = new Date("2026-09-05T00:00:00Z");
    expect(isStorageBackupStale(now, new Date("2026-09-01T00:00:00Z"))).toBe(false);
  });
  it("is fresh exactly at the 204h boundary", () => {
    const now = new Date("2026-09-09T00:00:00Z");
    const lastSuccess = new Date(now.getTime() - STORAGE_FRESHNESS_HOURS * 3_600_000);
    expect(isStorageBackupStale(now, lastSuccess)).toBe(false);
  });
  it("is stale one second past the 204h boundary", () => {
    const now = new Date("2026-09-09T00:00:01Z");
    const lastSuccess = new Date(now.getTime() - STORAGE_FRESHNESS_HOURS * 3_600_000 - 1000);
    expect(isStorageBackupStale(now, lastSuccess)).toBe(true);
  });
});

describe("latestTimestamp", () => {
  it("picks the most recent real timestamp, not a parsed date label", () => {
    // The regression this guards: the export runs at 02:30 Asia/Jerusalem, which during
    // Israeli Daylight Time is 23:30 UTC the PREVIOUS day - so a real completion timestamp can
    // legitimately be "later in the day" than what a naive folder-date-at-midnight would suggest.
    expect(latestTimestamp(["2026-08-28T23:30:00Z", "2026-08-30T23:30:00Z", "2026-08-29T23:30:00Z"])).toEqual(new Date("2026-08-30T23:30:00Z"));
  });
  it("returns null when there are no timestamps", () => {
    expect(latestTimestamp([])).toBeNull();
    expect(latestTimestamp([undefined, undefined])).toBeNull();
  });
});

describe("Firestore freshness regression: DST-shifted backup time must not read as stale", () => {
  it("a backup that completed at 23:30 UTC last night is fresh ~9.5h later, not stale", () => {
    // Reproduces the real 2026-08-31T07:07Z false CRITICAL alert: the export completed
    // 2026-08-30T23:30:00Z, and the watchdog ran ~9.5h later - genuinely fresh, well under 27h.
    const latest = latestTimestamp(["2026-08-30T23:30:00Z"]);
    const now = new Date("2026-08-31T09:00:00Z");
    expect(isFirestoreBackupStale(now, latest!)).toBe(false);
  });
});

describe("isRelevantActiveServiceHealthEvent", () => {
  it("flags an active event directly related to the project", () => {
    expect(isRelevantActiveServiceHealthEvent({ state: "ACTIVE", relevance: "RELATED" })).toBe(true);
    expect(isRelevantActiveServiceHealthEvent({ state: "ACTIVE", relevance: "IMPACTED" })).toBe(true);
  });
  it("ignores closed events", () => {
    expect(isRelevantActiveServiceHealthEvent({ state: "CLOSED", relevance: "IMPACTED" })).toBe(false);
  });
  it("ignores events with weak/unknown relevance", () => {
    expect(isRelevantActiveServiceHealthEvent({ state: "ACTIVE", relevance: "PARTIALLY_RELATED" })).toBe(false);
    expect(isRelevantActiveServiceHealthEvent({ state: "ACTIVE", relevance: "NOT_IMPACTED" })).toBe(false);
    expect(isRelevantActiveServiceHealthEvent({ state: "ACTIVE" })).toBe(false);
  });
});
