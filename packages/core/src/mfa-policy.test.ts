import { describe, expect, it } from "vitest";
import { isMfaEligibleRole, mfaEnrollmentOffered, mfaRequiredForRole, parseMfaEnforcementMode } from "./mfa-policy.js";

describe("parseMfaEnforcementMode", () => {
  it("defaults to off for unset/unknown values, so a missing env var never activates enforcement", () => {
    expect(parseMfaEnforcementMode(undefined)).toBe("off");
    expect(parseMfaEnforcementMode(null)).toBe("off");
    expect(parseMfaEnforcementMode("")).toBe("off");
    expect(parseMfaEnforcementMode("enabled")).toBe("off");
  });
  it("accepts the two staged modes verbatim", () => {
    expect(parseMfaEnforcementMode("optional")).toBe("optional");
    expect(parseMfaEnforcementMode("required")).toBe("required");
  });
});

describe("isMfaEligibleRole", () => {
  it("is limited to owner and admin", () => {
    expect(isMfaEligibleRole("owner")).toBe(true);
    expect(isMfaEligibleRole("admin")).toBe(true);
    expect(isMfaEligibleRole("operator")).toBe(false);
    expect(isMfaEligibleRole("member")).toBe(false);
    expect(isMfaEligibleRole("client")).toBe(false);
  });
});

describe("mfaRequiredForRole", () => {
  it("never requires MFA in off mode, regardless of role", () => {
    expect(mfaRequiredForRole("owner", "off")).toBe(false);
    expect(mfaRequiredForRole("admin", "off")).toBe(false);
  });
  it("never requires MFA in optional mode — it only offers enrollment", () => {
    expect(mfaRequiredForRole("owner", "optional")).toBe(false);
    expect(mfaRequiredForRole("admin", "optional")).toBe(false);
  });
  it("requires MFA only for owner/admin in required mode", () => {
    expect(mfaRequiredForRole("owner", "required")).toBe(true);
    expect(mfaRequiredForRole("admin", "required")).toBe(true);
    expect(mfaRequiredForRole("operator", "required")).toBe(false);
    expect(mfaRequiredForRole("member", "required")).toBe(false);
    expect(mfaRequiredForRole("client", "required")).toBe(false);
  });
});

describe("mfaEnrollmentOffered", () => {
  it("is not offered in off mode", () => {
    expect(mfaEnrollmentOffered("owner", "off")).toBe(false);
  });
  it("is offered to owner/admin in optional and required modes, never to other roles", () => {
    expect(mfaEnrollmentOffered("owner", "optional")).toBe(true);
    expect(mfaEnrollmentOffered("admin", "required")).toBe(true);
    expect(mfaEnrollmentOffered("operator", "required")).toBe(false);
    expect(mfaEnrollmentOffered("client", "optional")).toBe(false);
  });
});
