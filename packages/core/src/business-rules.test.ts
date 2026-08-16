import { describe, expect, it } from "vitest";
import { launchBusinessRules, validateBusinessRules } from "./business-rules.js";

describe("business rules", () => {
  it("publishes a valid, owner-gated launch policy", () => {
    expect(validateBusinessRules(launchBusinessRules)).toEqual(launchBusinessRules);
    expect(launchBusinessRules.commercial.maximumDiscountPercentWithoutOwnerApproval).toBe(0);
    expect(launchBusinessRules.hosting.backupRetentionDays).toBeGreaterThanOrEqual(30);
  });

  it("rejects discounts that bypass owner approval", () => {
    expect(() => validateBusinessRules({
      ...launchBusinessRules,
      commercial: {
        ...launchBusinessRules.commercial,
        maximumDiscountPercentWithoutOwnerApproval: 10,
      },
    })).toThrow("All launch discounts require owner approval");
  });
});
