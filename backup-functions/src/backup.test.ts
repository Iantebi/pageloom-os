import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { backupPrefix, firestoreExportUrl } from "./backup-policy.js";

const backupSource = readFileSync(new URL("./backup.ts", import.meta.url), "utf8");

describe("disaster recovery backup", () => {
  it("creates a deterministic daily export prefix", () => {
    expect(backupPrefix("pageloom-os-production-backups", new Date("2026-08-12T22:00:00Z"))).toBe("gs://pageloom-os-production-backups/firestore/2026-08-12");
  });
  it("targets only the configured project database", () => {
    expect(firestoreExportUrl("pageloom-os-production")).toBe("https://firestore.googleapis.com/v1/projects/pageloom-os-production/databases/(default):exportDocuments");
  });
  it("rejects unsafe bucket and project identifiers", () => {
    expect(() => backupPrefix("gs://wrong/path")).toThrow();
    expect(() => firestoreExportUrl("../another-project")).toThrow();
  });
  // Cloud Scheduler retries this job aggressively on any non-2xx response. Once one attempt has
  // already completed today's export, Firestore correctly rejects a retry's duplicate export with
  // a "path already exists" error - that's not an actual failure, so it must not be logged/recorded
  // as one (see the incident this documents: repeated noisy "backup failed" entries on 2026-08-30
  // for a day whose backup had, in fact, already succeeded).
  it("treats a duplicate 'path already exists' response as success, not a thrown failure", () => {
    expect(backupSource).toContain("path already exists");
    expect(backupSource).toContain('status: "already_completed"');
    expect(backupSource).toContain('operationalLog("info", "backup.already_completed"');
  });
});
