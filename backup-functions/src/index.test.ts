import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("backup-only deploy package", () => {
  it("exports exactly the two backup functions and nothing from the retired OS", () => {
    const exported = [...indexSource.matchAll(/^export const (\w+)/gm)].map((m) => m[1]).sort();
    expect(exported).toEqual(["backupFreshnessWatchdog", "dailyFirestoreBackup"]);
  });
  it("has no HTTP or Firestore triggers and binds no secrets", () => {
    expect(indexSource).not.toMatch(/onRequest|onCall|onDocument|secrets\s*:/);
  });
});
