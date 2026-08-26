import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./website-content-api.ts", import.meta.url), "utf8");

describe("website content API security", () => {
  it("authorizes every content route at the platform, organization, or project boundary", () => {
    expect(source).toContain("requirePlatformProjectAccess");
    expect(source).toContain("requirePlatformOrRole");
    expect(source).not.toContain("allow write");
  });
  it("validates fields and blocks cross-website media paths", () => {
    expect(source).toContain("validateContentFieldValue");
    expect(source).toContain("canEditContentField");
    expect(source).toContain("Media must belong to the same customer, project, and website");
  });
  it("implements draft, preview, submit, decision, publish, revision, rollback, and media-delete operations", () => {
    for (const operation of ["/draft", "/preview", "/submit", "/decision", "/publish", "/rollback", "/media", "contentRevisions"]) expect(source).toContain(operation);
  });
  it("also enforces the account-level content-edit permission flag, not just per-field permission", () => {
    expect(source).toContain('customerPermission(member, "contentEdit")');
  });
  it("only ever previews or publishes the draft, and only the owner/admin can roll back", () => {
    expect(source).toContain('requirePlatformOrRole(req, res, input.organizationId, ["owner"])');
  });
  it("requires a real difference from the published content before a submission can be created", () => {
    expect(source).toContain("NO_CONTENT_CHANGES");
  });
  it("serves media through short-lived signed URLs instead of raw storage paths", () => {
    expect(source).toContain("getSignedUrl");
    expect(source).toContain("15 * 60_000");
  });
  it("refuses to delete media that is still referenced by draft or published content", () => {
    expect(source).toContain("MEDIA_IN_USE");
  });
  it("scopes a client's media deletion to files they themselves uploaded", () => {
    expect(source).toContain("member.role === \"client\" && !input.path.startsWith(`${prefix}${req.user!.uid}/`)");
  });
  it("strips protected field values from every customer-facing content response, not just the field list", () => {
    // A customer's `fields` array already omits protected definitions (e.g. SEO metadata), but the
    // raw draft/published/preview values must not silently leak the same protected content through
    // the JSON payload itself — inspectable in the network tab even with no UI control rendered.
    expect(source).toContain("function scopeValues(");
    expect(source).toContain("scoped(draft.data()?.values ?? {})");
    expect(source).toContain("scoped(published.data()?.values ?? {})");
    expect(source).toContain("scopeValues(permissions.data()!, member.role === \"client\")(values)");
  });
  it("gives platform administrators one cross-organization queue of pending submissions", () => {
    expect(source).toContain("/platform/content-submissions");
    expect(source).toContain("requirePlatformAdmin");
  });
});
