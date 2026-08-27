import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");

describe("client project access", () => {
  it("treats an empty projectIds array as unrestricted rather than locking the client out of every project", () => {
    // A portal invitation created with no projects selected stores projectIds:[] (see customer-invitations.ts
    // and customer-admin-api.ts). Array.isArray([]) is true, so without the length check below, every
    // project lookup would find an empty allow-list and deny access — the opposite of "no selection = all access".
    expect(source).toContain("Array.isArray(member.projectIds)&&member.projectIds.length>0");
  });
  it("still restricts access once at least one project is explicitly assigned", () => {
    expect(source).toContain("allowedProjects&&!allowedProjects.includes(projectId)");
  });
  it("denies disabled members before checking role", () => {
    expect(source).toContain("member.data()?.disabled===true");
  });
  it("keeps platform-administrator escalation behind a verified Firebase claim or an active registry entry", () => {
    expect(source).toContain('["owner","admin"].includes(req.user?.platformRole??"")');
    expect(source).toContain("administrator.data()?.active!==false");
  });
});

describe("token revocation check", () => {
  it("still checks revocation in production (or any real deployment) — only skips it under the Functions emulator", () => {
    // verifyIdToken's checkRevoked=true performs a live call to the Identity Toolkit backend, which needs
    // Application Default Credentials the Functions emulator has no way to obtain without `firebase login` —
    // it hangs for ~90s probing the (nonexistent, off-GCE) metadata server before failing. That delay routinely
    // exceeds upstream proxy timeouts, turning a clean 401 into an opaque, content-type-less 500. Skipping the
    // revocation round-trip only when FUNCTIONS_EMULATOR==="true" keeps production behavior identical while
    // making local dev actually work; it does not weaken any authorization check itself.
    expect(source).toContain('auth.verifyIdToken(header.slice(7),process.env.FUNCTIONS_EMULATOR!=="true")');
  });
});
