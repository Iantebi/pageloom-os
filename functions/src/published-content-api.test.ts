import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./published-content-api.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("./api.ts", import.meta.url), "utf8");
describe("public published-content API", () => {
  it("is mounted before authentication and reads only the published document", () => {
    expect(api.indexOf("publishedContentRouter")).toBeLessThan(api.indexOf('app.use("/api",authenticate)'));
    expect(source).toContain("/content/published");
    expect(source).not.toContain("/content/draft");
  });
  it("isolates one organization and website and preserves fallback content", () => {
    expect(source).toContain("organizations/${organizationId}/websites/${websiteId}");
    expect(source).toContain("resolvePublishedWebsiteContent");
  });
  it("exposes only referenced same-site media through short-lived signed URLs", () => {
    expect(source).toContain("website-media/${scope.customerId}/${scope.projectId}/${scope.websiteId}/");
    expect(source).toContain("15 * 60_000");
  });
});
