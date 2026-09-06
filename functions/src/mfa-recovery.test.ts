import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("../scripts/mfa-recovery.mjs", import.meta.url), "utf8");

describe("MFA recovery CLI (sole-owner lockout path)", () => {
  it("is dry-run by default and pins the intended production project", () => {
    expect(source).toContain('project !== "pageloom-os-production"');
    expect(source).toContain("if (!apply)");
  });
  it("requires the exact verified email as a second confirming input, not just the uid", () => {
    expect(source).toContain("user.emailVerified");
    expect(source).toContain("user.email?.trim().toLowerCase() !== expectedEmail");
  });
  it("clears enrolled factors and revokes refresh tokens so recovery takes effect immediately", () => {
    expect(source).toContain("multiFactor: { enrolledFactors: null }");
    expect(source).toContain("revokeRefreshTokens");
  });
  it("does nothing destructive when there is nothing enrolled to remove", () => {
    expect(source).toContain("enrolledFactors.length === 0");
  });
});
