import { TotpMultiFactorGenerator } from "firebase/auth";
import { describe, expect, it } from "vitest";
import { isMfaRequiredError, totpHint } from "./mfa-predicates";

describe("isMfaRequiredError", () => {
  it("recognizes the exact Firebase Auth error code thrown mid sign-in", () => {
    expect(isMfaRequiredError({ code: "auth/multi-factor-auth-required" })).toBe(true);
  });
  it("does not misclassify unrelated auth errors, e.g. wrong password", () => {
    expect(isMfaRequiredError({ code: "auth/wrong-password" })).toBe(false);
  });
  it("does not throw on non-error values (null, undefined, a plain string)", () => {
    expect(isMfaRequiredError(null)).toBe(false);
    expect(isMfaRequiredError(undefined)).toBe(false);
    expect(isMfaRequiredError("not an error")).toBe(false);
  });
});

describe("totpHint", () => {
  it("picks the TOTP hint out of a resolver offering multiple factor types", () => {
    const hints = [
      { uid: "phone-1", factorId: "phone", displayName: "Phone" },
      { uid: "totp-1", factorId: TotpMultiFactorGenerator.FACTOR_ID, displayName: "Authenticator app" },
    ] as never;
    expect(totpHint({ hints })?.uid).toBe("totp-1");
  });
  it("returns undefined when no TOTP factor is enrolled", () => {
    const hints = [{ uid: "phone-1", factorId: "phone", displayName: "Phone" }] as never;
    expect(totpHint({ hints })).toBeUndefined();
  });
});
