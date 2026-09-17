import { describe, expect, it } from "vitest";
import { INITIAL_DISCOVERY_DATA } from "../data/initialData";
import type { DiscoveryData } from "../types";
import { canProceedFromStep, hasAnyMissingRequiredField, missingFieldsForStep, missingQuestionIdsForStep } from "./discoveryValidation";

// Real requiredness comes from packages/core's discoveryTemplate (post the 2026-09-17 loosening
// for questions this frontend has no step for) — these tests pin the exact 13 required questions
// that loosening left in place, and which of this frontend's own fields answer each one, so this
// suite fails loudly if a future core change silently un-blocks (or newly blocks) a step here.

const blank: DiscoveryData = {
  ...INITIAL_DISCOVERY_DATA,
  businessName: "", phone: "", email: "",
  idealCustomer: "", customerProblem: "", customerDesire: "",
  services: [{ id: "srv-1", name: "", problemSolved: "", resultReceived: "", whyValuable: "", priceEstimate: "" }],
  whyChooseYou: "", uniqueDifferentiator: "",
  brandStyle: "", brandColors: { primary: "", secondary: "" }, logoStatus: "" as unknown as DiscoveryData["logoStatus"],
  hasExistingDomain: null,
};

describe("discoveryValidation — step 1 (Business Identity)", () => {
  it("blocks when businessName/phone/email are all empty", () => {
    expect(canProceedFromStep(1, blank)).toBe(false);
    expect(missingFieldsForStep(1, blank)).toEqual(new Set(["businessName", "phone", "email"]));
  });
  it("unblocks once all three are filled", () => {
    const filled = { ...blank, businessName: "עסק בדיקה", phone: "050-1234567", email: "a@b.co" };
    expect(canProceedFromStep(1, filled)).toBe(true);
    expect(missingQuestionIdsForStep(1, filled)).toEqual([]);
  });
  it("still blocks if only two of the three are filled", () => {
    const partial = { ...blank, businessName: "עסק בדיקה", phone: "050-1234567" };
    expect(canProceedFromStep(1, partial)).toBe(false);
    expect(missingFieldsForStep(1, partial)).toEqual(new Set(["email"]));
  });
});

describe("discoveryValidation — step 2 (Customers)", () => {
  it("blocks when the three customer questions are empty", () => {
    expect(canProceedFromStep(2, blank)).toBe(false);
    expect(missingFieldsForStep(2, blank)).toEqual(new Set(["idealCustomer", "customerProblem", "customerDesire"]));
  });
  it("unblocks once filled — customerFears/customerObstacles are NOT required", () => {
    const filled = { ...blank, idealCustomer: "x", customerProblem: "y", customerDesire: "z" };
    expect(canProceedFromStep(2, filled)).toBe(true);
  });
});

describe("discoveryValidation — step 3 (Services)", () => {
  it("blocks when every service row has an empty name", () => {
    expect(canProceedFromStep(3, blank)).toBe(false);
    expect(missingFieldsForStep(3, blank)).toEqual(new Set(["services"]));
  });
  it("unblocks once at least one service has a name", () => {
    const filled = { ...blank, services: [{ id: "srv-1", name: "ניקוי מזגנים", problemSolved: "", resultReceived: "", whyValuable: "", priceEstimate: "" }] };
    expect(canProceedFromStep(3, filled)).toBe(true);
  });
});

describe("discoveryValidation — step 4 (Advantage) — either/or field", () => {
  it("blocks when both whyChooseYou and uniqueDifferentiator are empty", () => {
    expect(canProceedFromStep(4, blank)).toBe(false);
    expect(missingFieldsForStep(4, blank)).toEqual(new Set(["whyChooseYou", "uniqueDifferentiator"]));
  });
  it("unblocks when only whyChooseYou is filled", () => {
    expect(canProceedFromStep(4, { ...blank, whyChooseYou: "יחס אישי" })).toBe(true);
  });
  it("unblocks when only uniqueDifferentiator is filled", () => {
    expect(canProceedFromStep(4, { ...blank, uniqueDifferentiator: "ציוד ייחודי" })).toBe(true);
  });
});

describe("discoveryValidation — step 5 (Brand)", () => {
  it("blocks when style/colors/logoStatus are all unset", () => {
    expect(canProceedFromStep(5, blank)).toBe(false);
    expect(missingFieldsForStep(5, blank)).toEqual(new Set(["brandStyle", "brandColors", "logoStatus"]));
  });
  it("INITIAL_DISCOVERY_DATA's own sensible defaults already satisfy step 5 untouched", () => {
    expect(canProceedFromStep(5, INITIAL_DISCOVERY_DATA)).toBe(true);
  });
  it("a logoStatus of 'needs_new_logo' (a real, meaningful choice) still satisfies branding.hasLogo", () => {
    const filled = { ...blank, brandStyle: "modern_minimal", brandColors: { primary: "#111111", secondary: "#222222" }, logoStatus: "needs_new_logo" as const };
    expect(canProceedFromStep(5, filled)).toBe(true);
  });
});

describe("discoveryValidation — step 7 (Technical)", () => {
  it("blocks while hasExistingDomain is still null (never answered)", () => {
    expect(canProceedFromStep(7, blank)).toBe(false);
    expect(missingFieldsForStep(7, blank)).toEqual(new Set(["hasExistingDomain"]));
  });
  it("a `false` answer ('no domain yet') is a complete answer, not a missing one", () => {
    expect(canProceedFromStep(7, { ...blank, hasExistingDomain: false })).toBe(true);
  });
  it("a `true` answer also satisfies it", () => {
    expect(canProceedFromStep(7, { ...blank, hasExistingDomain: true })).toBe(true);
  });
});

describe("discoveryValidation — step 6 (Uploads) and step 8 (Review) special cases", () => {
  it("step 6 has no required fields of its own — always proceedable", () => {
    expect(canProceedFromStep(6, blank)).toBe(true);
  });
  it("step 8 blocks on EVERY required question across the whole flow, not just its own (it has none)", () => {
    expect(canProceedFromStep(8, blank)).toBe(false);
    const everythingFilled: DiscoveryData = {
      ...blank,
      businessName: "עסק", phone: "050-1234567", email: "a@b.co",
      idealCustomer: "x", customerProblem: "y", customerDesire: "z",
      services: [{ id: "srv-1", name: "שירות", problemSolved: "", resultReceived: "", whyValuable: "", priceEstimate: "" }],
      whyChooseYou: "יחס אישי",
      brandStyle: "modern_minimal", brandColors: { primary: "#111111", secondary: "#222222" }, logoStatus: "has_logo",
      hasExistingDomain: false,
    };
    expect(canProceedFromStep(8, everythingFilled)).toBe(true);
    expect(hasAnyMissingRequiredField(everythingFilled)).toBe(false);
  });
});

describe("discoveryValidation — hasAnyMissingRequiredField", () => {
  it("is true for a brand-new, untouched Discovery", () => {
    expect(hasAnyMissingRequiredField(blank)).toBe(true);
  });
});
