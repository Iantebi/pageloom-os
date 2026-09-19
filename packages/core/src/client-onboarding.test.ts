import { describe, expect, it } from "vitest";
import { createClientSchema } from "./client-onboarding.js";

describe("createClientSchema", () => {
  it("accepts the four required fields plus optional notes", () => {
    const parsed = createClientSchema.parse({
      organizationId: "org1", businessName: "Acme Plumbing", contactName: "Yossi Levi",
      email: "yossi@acme.co.il", phone: "050-1234567", notes: "Met at a networking event.",
    });
    expect(parsed.businessName).toBe("Acme Plumbing");
  });
  it("allows omitting notes", () => {
    expect(() => createClientSchema.parse({ organizationId: "org1", businessName: "Acme", contactName: "Yossi", email: "yossi@acme.co.il", phone: "0501234567" })).not.toThrow();
  });
  it("rejects an invalid email", () => {
    expect(() => createClientSchema.parse({ organizationId: "org1", businessName: "Acme", contactName: "Yossi", email: "not-an-email", phone: "0501234567" })).toThrow();
  });
  it("rejects a business name that's too short", () => {
    expect(() => createClientSchema.parse({ organizationId: "org1", businessName: "A", contactName: "Yossi", email: "yossi@acme.co.il", phone: "0501234567" })).toThrow();
  });
});
