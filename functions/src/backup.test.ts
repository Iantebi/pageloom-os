import { describe, expect, it } from "vitest";
import { backupPrefix, firestoreExportUrl } from "./backup-policy.js";

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
});
