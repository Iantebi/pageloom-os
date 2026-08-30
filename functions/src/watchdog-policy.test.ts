import { describe, expect, it } from "vitest";
import {
  FIRESTORE_FRESHNESS_HOURS,
  STORAGE_FRESHNESS_HOURS,
  isFirestoreBackupStale,
  isStorageBackupStale,
  latestBackupFolderDate,
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

describe("latestBackupFolderDate", () => {
  it("picks the most recent ISO date folder", () => {
    expect(latestBackupFolderDate(["firestore/2026-08-28/", "firestore/2026-08-30/", "firestore/2026-08-29/"])).toEqual(new Date("2026-08-30T00:00:00Z"));
  });
  it("returns null when no folders match", () => {
    expect(latestBackupFolderDate([])).toBeNull();
    expect(latestBackupFolderDate(["firestore/not-a-date/"])).toBeNull();
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
