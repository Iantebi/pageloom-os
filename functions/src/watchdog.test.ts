import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const watchdogSource = readFileSync(new URL("./watchdog.ts", import.meta.url), "utf8");

describe("backup freshness watchdog pagination", () => {
  // Regression: both the Firestore export bucket listing and the Storage Transfer operations
  // listing must follow nextPageToken (via collectAllPages) instead of reading only the first page -
  // see watchdog-policy.test.ts's "collectAllPages" suite for the behavioral proof, and the comment
  // in checkFirestoreFreshness for why a truncated first page silently hides the latest backup.
  it("paginates the Firestore backup bucket listing through collectAllPages", () => {
    expect(watchdogSource).toContain("collectAllPages<{ timeCreated?: string }>");
    expect(watchdogSource).toContain('"fields", "nextPageToken,items(timeCreated)"');
  });
  it("paginates the Storage Transfer operations listing through collectAllPages", () => {
    expect(watchdogSource).toContain("collectAllPages<{ metadata?: { status?: string; endTime?: string } }>");
    expect(watchdogSource).toContain("result.nextPageToken");
  });
});
