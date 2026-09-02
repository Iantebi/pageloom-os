import { describe, expect, it } from "vitest";
import {
  discoverySectionOrder, discoveryTemplate, discoveryQuestion, discoverySection,
  isQuestionVisible, missingRequiredDiscoveryFields, isSectionComplete, discoveryProgressPercent,
  semanticTags, type DiscoveryResponses,
} from "./discovery-template.js";
import {
  saveDiscoverySectionSchema, submitDiscoverySchema, reopenDiscoverySectionSchema,
  discoveryResponsesSchema, discoveryServiceEntrySchema,
} from "./discovery.js";

describe("discovery template structure", () => {
  it("has exactly the 9 mission-specified sections in order", () => {
    expect(discoverySectionOrder).toEqual([
      "business", "customers", "services", "differentiation", "trust",
      "branding", "materials", "presence", "goals",
    ]);
    expect(discoveryTemplate.map(section => section.id)).toEqual([...discoverySectionOrder]);
    expect(discoveryTemplate.map(section => section.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("has unique question ids across the whole template", () => {
    const ids = discoveryTemplate.flatMap(section => section.questions.map(question => question.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(20);
  });

  it("every question belongs to the section it's nested under", () => {
    for (const section of discoveryTemplate) {
      for (const question of section.questions) expect(question.sectionId).toBe(section.id);
    }
  });

  it("every question has a valid semantic tag", () => {
    for (const section of discoveryTemplate) {
      for (const question of section.questions) expect(semanticTags).toContain(question.semanticTag);
    }
  });

  it("select/multi_select questions declare options", () => {
    for (const section of discoveryTemplate) {
      for (const question of section.questions) {
        if (question.type === "select" || question.type === "multi_select" || question.type === "color_pair") {
          expect(question.options?.length ?? 0).toBeGreaterThan(0);
        }
      }
    }
  });

  it("does not ask the customer to write headline/subheadline/CTA copy", () => {
    const ids = discoveryTemplate.flatMap(section => section.questions.map(question => question.id.toLowerCase()));
    for (const forbidden of ["headline", "subheadline", "ctacopy", "seocopy"]) {
      expect(ids.some(id => id.includes(forbidden))).toBe(false);
    }
  });

  it("looks up a question and a section by id, and throws for unknown ids", () => {
    expect(discoveryQuestion("business.publicName").sectionId).toBe("business");
    expect(discoverySection("goals").questions.length).toBeGreaterThan(0);
    expect(() => discoveryQuestion("nope")).toThrow();
    expect(() => discoverySection("nope" as never)).toThrow();
  });
});

describe("isQuestionVisible", () => {
  it("is always visible with no visibleIf", () => {
    const question = discoveryQuestion("business.publicName");
    expect(isQuestionVisible(question, {})).toBe(true);
  });

  it("hides existing-website detail question until hasWebsite=true", () => {
    const question = discoveryQuestion("presence.existingWebsiteUrl");
    expect(isQuestionVisible(question, {})).toBe(false);
    expect(isQuestionVisible(question, { "presence.hasWebsite": false })).toBe(false);
    expect(isQuestionVisible(question, { "presence.hasWebsite": true })).toBe(true);
  });

  it("shows the testimonial upload only when the customer has testimonials, and the help-offer only when they don't", () => {
    const upload = discoveryQuestion("trust.testimonials");
    const helpOffer = discoveryQuestion("trust.wantsHelpCollecting");
    const withTestimonials: DiscoveryResponses = { "trust.hasTestimonials": true };
    const withoutTestimonials: DiscoveryResponses = { "trust.hasTestimonials": false };
    expect(isQuestionVisible(upload, withTestimonials)).toBe(true);
    expect(isQuestionVisible(upload, withoutTestimonials)).toBe(false);
    expect(isQuestionVisible(helpOffer, withTestimonials)).toBe(false);
    expect(isQuestionVisible(helpOffer, withoutTestimonials)).toBe(true);
  });
});

describe("missingRequiredDiscoveryFields / isSectionComplete", () => {
  it("reports every required, visible, empty question in a section", () => {
    const section = discoverySection("business");
    const missing = missingRequiredDiscoveryFields(section, {});
    expect(missing).toEqual(expect.arrayContaining(["business.publicName", "business.whatItDoes", "business.customerFeeling"]));
    expect(missing).not.toContain("business.story");
  });

  it("never reports a required-but-hidden question as missing", () => {
    const section = discoverySection("trust");
    const responses: DiscoveryResponses = { "trust.hasTestimonials": false };
    const missing = missingRequiredDiscoveryFields(section, responses);
    expect(missing).not.toContain("trust.testimonials");
  });

  it("treats an empty array, empty string, false, undefined as missing for a required field", () => {
    const section = discoverySection("services");
    expect(missingRequiredDiscoveryFields(section, { "services.list": [] })).toContain("services.list");
    expect(missingRequiredDiscoveryFields(section, {})).toContain("services.list");
  });

  it("isSectionComplete reflects missingRequiredDiscoveryFields exactly", () => {
    const section = discoverySection("goals");
    expect(isSectionComplete(section, {})).toBe(false);
    const complete: DiscoveryResponses = {
      "goals.biggestProblem": "x", "goals.sixMonthSuccess": "x",
      "goals.priorityOutcomes": ["more_inquiries"], "goals.capacityCheck": "x",
    };
    expect(isSectionComplete(section, complete)).toBe(true);
  });
});

describe("discoveryProgressPercent", () => {
  it("is 0 when nothing is completed and 100 when all 9 are", () => {
    expect(discoveryProgressPercent([])).toBe(0);
    expect(discoveryProgressPercent([...discoverySectionOrder])).toBe(100);
  });

  it("de-duplicates repeated section ids rather than over-counting", () => {
    expect(discoveryProgressPercent(["business", "business", "customers"])).toBe(Math.round((2 / 9) * 100));
  });
});

describe("discovery API payload schemas", () => {
  it("rejects a save payload with a malformed response value", () => {
    expect(() => saveDiscoverySectionSchema.parse({ organizationId: "org1", responses: { x: { nope: true } } })).toThrow();
  });
  it("accepts a save payload with plausible mixed response types", () => {
    const parsed = saveDiscoverySectionSchema.parse({
      organizationId: "org1",
      responses: { "business.publicName": "Acme", "trust.hasTestimonials": false, "branding.colors": ["#112233"] },
    });
    expect(parsed.responses["business.publicName"]).toBe("Acme");
  });
  it("requires a reason to reopen a section", () => {
    expect(() => reopenDiscoverySectionSchema.parse({ organizationId: "org1" })).toThrow();
    expect(() => reopenDiscoverySectionSchema.parse({ organizationId: "org1", reason: "missing photos" })).not.toThrow();
  });
  it("submit only requires organizationId — validation of section completeness happens server-side against Firestore state, not the payload", () => {
    expect(() => submitDiscoverySchema.parse({ organizationId: "org1" })).not.toThrow();
  });
  it("discoveryResponsesSchema accepts an empty draft", () => {
    expect(() => discoveryResponsesSchema.parse({})).not.toThrow();
  });
  it("service_repeater entries default promote to false", () => {
    const entry = discoveryServiceEntrySchema.parse({ name: "Haircuts" });
    expect(entry.promote).toBe(false);
  });
});
