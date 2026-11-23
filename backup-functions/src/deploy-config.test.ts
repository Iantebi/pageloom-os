// Guards the repository's deploy configuration so a plain `firebase deploy` (with or without
// --only functions) can never re-create the retired PageLoom OS functions or its website.
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

// Deploys are manual-only, each with its own approval (CLAUDE.md). Nothing automated may be able to
// deploy, or hold Google Cloud credentials that could: no workflow and no npm script.
describe("no automated deploy path", () => {
  const deployOrAuth = /firebase\s+deploy|gcloud\s|google-github-actions\/auth|GOOGLE_APPLICATION_CREDENTIALS|workload_identity_provider/;
  it("no GitHub workflow deploys or authenticates to Google Cloud", () => {
    const dir = new URL(".github/workflows/", root);
    const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    // Comment lines may mention deploy commands (documentation); only executable YAML counts.
    const code = (f: string) => readFileSync(new URL(f, dir), "utf8").split(/\r?\n/).filter((line) => !/^\s*#/.test(line)).join("\n");
    for (const f of files) expect(code(f), f).not.toMatch(deployOrAuth);
  });
  it("no package.json script deploys", () => {
    for (const p of ["package.json", "backup-functions/package.json"]) {
      const scripts = JSON.parse(readFileSync(new URL(p, root), "utf8")).scripts ?? {};
      for (const [name, cmd] of Object.entries(scripts)) expect(String(cmd), `${p} > ${name}`).not.toMatch(/firebase\s+deploy/);
    }
  });
});
