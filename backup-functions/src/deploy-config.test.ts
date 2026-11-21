// Guards the repository's deploy configuration so a plain `firebase deploy` (with or without
// --only functions) can never re-create the retired PageLoom OS functions or its website.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);
const firebase = JSON.parse(readFileSync(new URL("firebase.json", root), "utf8"));

describe("firebase.json deploy targets", () => {
  it("deploys functions only from backup-functions/", () => {
    const sources = (firebase.functions ?? []).map((f: { source: string }) => f.source);
    expect(sources).toEqual(["backup-functions"]);
  });
  it("has no hosting target (the retired OS web app must not be redeployed)", () => {
    expect(firebase.hosting).toBeUndefined();
  });
  it("still deploys the security rules from the tested files", () => {
    expect(firebase.firestore?.rules).toBe("firestore.rules");
    expect(firebase.storage?.rules).toBe("storage.rules");
  });
  it("no alternate firebase config can deploy the old functions/ codebase", () => {
    expect(existsSync(new URL("firebase.os-e2e.json", root))).toBe(false);
  });
});
