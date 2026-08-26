import { describe, expect, it, vi } from "vitest";
import { loadPublishedWebsiteContent, resolvePublishedWebsiteContent } from "./published-content-runtime.js";

describe("published website content runtime", () => {
  it("overlays only valid published values on existing site fallbacks", () => {
    const values = resolvePublishedWebsiteContent({ heroHeading: "Existing", phone: "123" }, { heroHeading: "Published", unknown: "ignored" });
    expect(values.heroHeading).toBe("Published");
    expect(values.phone).toBe("123");
    expect(values).not.toHaveProperty("unknown");
  });

  it("keeps the existing website usable when the public source is unavailable", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await loadPublishedWebsiteContent({ baseUrl: "https://platform.example", organizationId: "org-a", websiteId: "site-a", fallback: { heroHeading: "Existing" }, fetcher });
    expect(result.source).toBe("fallback");
    expect(result.values.heroHeading).toBe("Existing");
  });

  it("requests one explicitly scoped website and consumes published content", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { organizationId: "org-a", websiteId: "site-a", version: 2, source: "published", values: { heroHeading: "Live" } } }) });
    const result = await loadPublishedWebsiteContent({ baseUrl: "https://platform.example/", organizationId: "org-a", websiteId: "site-a", fetcher: fetcher as unknown as typeof fetch });
    expect(fetcher).toHaveBeenCalledWith("https://platform.example/api/public/organizations/org-a/websites/site-a/content", expect.anything());
    expect(result.values.heroHeading).toBe("Live");
  });
});
