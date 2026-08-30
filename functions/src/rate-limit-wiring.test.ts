import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Source-text assertions, matching this codebase's established pattern for verifying Firestore-
// touching wiring without mocking firebase-admin (see e.g. operational-records-api.test.ts,
// published-content-api.test.ts, business-automation.test.ts).
const rateLimit = readFileSync(new URL("./rate-limit.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("./api.ts", import.meta.url), "utf8");
const operationalRecords = readFileSync(new URL("./operational-records-api.ts", import.meta.url), "utf8");
const customerAdmin = readFileSync(new URL("./customer-admin-api.ts", import.meta.url), "utf8");
const publishedContent = readFileSync(new URL("./published-content-api.ts", import.meta.url), "utf8");

describe("rate limiter core", () => {
  it("checks and increments the Firestore counter atomically inside a transaction", () => {
    expect(rateLimit).toContain("db.runTransaction");
    expect(rateLimit).toContain('db.collection("rateLimits").doc(key)');
  });
  it("fails open (calls next()) when the Firestore check itself throws", () => {
    expect(rateLimit).toContain("catch (error)");
    expect(rateLimit.indexOf("rate_limit.check_failed")).toBeGreaterThan(rateLimit.indexOf("async function rateLimitMiddleware"));
  });
  it("returns 429 with this API's established error envelope, not a new one", () => {
    expect(rateLimit).toContain('res.status(429).json({ error: { code: "RATE_LIMITED"');
  });
  it("logs abuse events through the shared operationalLog helper, never a raw identity", () => {
    expect(rateLimit).toContain('operationalLog("warning", "rate_limit.exceeded"');
    expect(rateLimit).toContain("identityFingerprint(identity)");
    expect(rateLimit).not.toContain("identity: identity,");
  });
  it("keys the public content endpoint by IP and everything else by authenticated uid", () => {
    expect(rateLimit).toContain("export function uidKey(req: Request) {");
    expect(rateLimit).toContain("export function clientIpKey(req: Request) {");
    expect(rateLimit).toContain("return req.ip;");
  });
});

describe("trust proxy for Cloud Functions 2nd-gen (Cloud Run)", () => {
  it("trusts exactly one hop (Google's Front End) so req.ip resolves to the real client", () => {
    expect(api).toContain('app.set("trust proxy",1)');
  });
});

describe("rate limiting is wired onto every audit-flagged endpoint", () => {
  it("support ticket creation — staff and customer-portal paths", () => {
    expect(operationalRecords).toContain('rateLimit("support-ticket-staff"');
    expect(operationalRecords).toContain('operationalRecordsRouter.post("/support-tickets", rateLimit(');
    expect(operationalRecords).toContain('rateLimit("support-ticket-portal"');
    expect(operationalRecords).toContain('operationalRecordsRouter.post("/projects/:projectId/support-tickets", rateLimit(');
  });
  it("invitation creation — CRM and admin-console paths", () => {
    expect(api).toContain('rateLimit("invitation-create"');
    expect(api).toContain('app.post("/api/customers/:customerId/invitations",rateLimit(');
    expect(customerAdmin).toContain('rateLimit("invitation-create-admin"');
    expect(customerAdmin).toContain("portal-users/invite\",rateLimit(");
  });
  it("upload-adjacent metadata recording", () => {
    expect(api).toContain('rateLimit("upload-metadata"');
    expect(api).toContain('app.post("/api/customers/:customerId/documents",rateLimit(');
  });
  it("AI-triggering endpoints — job assignment and manual AI output", () => {
    expect(api).toContain('rateLimit("ai-job-assign"');
    expect(api).toContain('app.post("/api/jobs",rateLimit(');
    expect(api).toContain('rateLimit("ai-manual-output"');
    expect(api).toContain('app.post("/api/tasks/:taskId/manual-output",rateLimit(');
  });
  it("the public unauthenticated content endpoint, keyed by client IP", () => {
    expect(publishedContent).toContain('rateLimit("public-content"');
    expect(publishedContent).toContain("clientIpKey");
    expect(publishedContent.indexOf("rateLimit(")).toBeLessThan(publishedContent.indexOf("async (req, res) =>"));
  });
});
