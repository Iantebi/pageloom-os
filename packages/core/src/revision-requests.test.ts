import { describe, expect, it } from "vitest";
import { createRevisionRequestSchema, resolveRevisionRequestSchema } from "./revision-requests.js";

describe("revision request schemas", () => {
  it("accepts a valid revision request", () => {
    const parsed = createRevisionRequestSchema.parse({ organizationId: "org1", description: "Please make the hero button bigger", area: "Homepage" });
    expect(parsed.description).toBe("Please make the hero button bigger");
  });
  it("allows omitting the optional area", () => {
    expect(() => createRevisionRequestSchema.parse({ organizationId: "org1", description: "Fix the footer phone number" })).not.toThrow();
  });
  it("rejects an empty description", () => {
    expect(() => createRevisionRequestSchema.parse({ organizationId: "org1", description: "" })).toThrow();
  });
  it("requires a resolution note to resolve a request", () => {
    expect(() => resolveRevisionRequestSchema.parse({ organizationId: "org1", resolutionNote: "" })).toThrow();
    expect(resolveRevisionRequestSchema.parse({ organizationId: "org1", resolutionNote: "Updated the button size" }).resolutionNote).toBe("Updated the button size");
  });
});
