import { describe, expect, it } from "vitest";
import { questionnaireFieldSchema } from "./client-management.js";
import { websiteBriefFields, websiteBriefTitle } from "./website-brief.js";

describe("website brief field definitions", () => {
  it("is a non-empty, valid questionnaire field list", () => {
    expect(websiteBriefFields.length).toBeGreaterThan(10);
    for (const field of websiteBriefFields) expect(() => questionnaireFieldSchema.parse(field)).not.toThrow();
  });
  it("has unique field ids", () => {
    const ids = websiteBriefFields.map(field => field.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("covers every mission-required section with at least one field", () => {
    const ids = new Set(websiteBriefFields.map(field => field.id));
    for (const required of ["businessName", "websiteGoal", "targetAudience", "services", "businessDescription", "advantages", "testimonials", "faqs", "brandingNotes", "brandColors", "logo", "inspirationSites", "introPhoto", "introVideo", "socialLinks", "googleBusinessUrl", "whatsappNumber", "existingDomain", "existingWebsiteUrl", "additionalNotes"]) {
      expect(ids.has(required), required).toBe(true);
    }
  });
  it("requires only the fields genuinely needed to start a build", () => {
    const required = websiteBriefFields.filter(field => field.required).map(field => field.id);
    expect(required).toEqual(expect.arrayContaining(["businessName", "businessPhone", "businessEmail", "websiteGoal", "targetAudience", "services", "businessDescription"]));
  });
  it("has a non-empty title", () => expect(websiteBriefTitle.length).toBeGreaterThan(0));
});
