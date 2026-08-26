import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("../scripts/provision-platform-owner.mjs", import.meta.url), "utf8");
describe("first owner provisioning", () => {
  it("is dry-run by default and pins the intended production project", () => { expect(source).toContain('project !== "pageloom-os-production"'); expect(source).toContain("if (!apply)"); });
  it("requires an exact verified identity and preserves unrelated claims", () => { expect(source).toContain("user.emailVerified"); expect(source).toContain("...previousClaims"); expect(source).toContain("revokeRefreshTokens"); });
  it("uses both a custom claim and auditable administrator registry", () => { expect(source).toContain('platformRole: "owner"'); expect(source).toContain("systemAdministrators/${uid}"); });
});
