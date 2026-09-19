import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./client-onboarding-api.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("./api.ts", import.meta.url), "utf8");
const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");

describe("New Client onboarding — independent of the CRM and Backend Master", () => {
  it("creating a client requires staff authority, not the CRM's lead/deal-closed schema", () => {
    expect(source).toContain('requireRole(req, res, input.organizationId, ["owner", "admin", "operator"])');
    expect(source).toContain("createClientSchema.parse(req.body)");
    expect(source).not.toMatch(/\binput\.leadId\b/);
  });

  it("advances the real workflow engine (not just display fields) so later customer-review events aren't silently ignored", () => {
    expect(source).toContain('type: "PaymentConfirmed"');
    expect(source).toContain('type: "OnboardingStarted"');
    expect(source).toContain('type: "OnboardingCompleted"');
    expect((source.match(/engine\.process\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("generates a cryptographically random, URL-safe token — never a guessable or sequential id", () => {
    expect(source).toContain('randomBytes(24).toString("base64url")');
  });

  it("scopes a claimed link to exactly one project — never the customer's other projects or another customer's", () => {
    expect(source).toContain("projectIds: [data.projectId]");
    expect(source).toContain('role: "client"');
  });

  it("the claim endpoint is public (mounted before authenticate) and rate-limited by IP, like the one other public route", () => {
    const publishedIndex = api.indexOf('app.use("/api",publishedContentRouter)');
    const discoveryLinkIndex = api.indexOf('app.use("/api",discoveryLinkRouter)');
    const authenticateIndex = api.indexOf('app.use("/api",authenticate)');
    expect(publishedIndex).toBeGreaterThan(-1);
    expect(discoveryLinkIndex).toBeGreaterThan(publishedIndex);
    expect(authenticateIndex).toBeGreaterThan(discoveryLinkIndex);
    expect(source).toContain('rateLimit("discovery-link-claim"');
    expect(source).toContain("clientIpKey");
  });

  it("still requires a verified Firebase session (even an anonymous one) to claim — it's public routing, not public data access", () => {
    expect(source).toContain("auth.verifyIdToken(header.slice(7)");
  });

  it("discoveryInvites are never client-readable or client-writable — every access goes through the Admin SDK", () => {
    expect(rules).toContain("match /discoveryInvites/{token} { allow read, write: if false; }");
  });
});
