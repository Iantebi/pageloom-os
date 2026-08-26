import { Router } from "express";
import { resolvePublishedWebsiteContent } from "@pageloom/core";
import { z } from "zod";
import { db, storage } from "./firebase.js";

export const publishedContentRouter = Router();
const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);

publishedContentRouter.get("/public/organizations/:organizationId/websites/:websiteId/content", async (req, res) => {
  try {
    const organizationId = id.parse(req.params.organizationId), websiteId = id.parse(req.params.websiteId);
    const website = await db.doc(`organizations/${organizationId}/websites/${websiteId}`).get();
    if (!website.exists || website.data()?.publicContentEnabled === false) return res.status(404).json({ error: { code: "WEBSITE_NOT_FOUND", message: "Published website content was not found" } });
    const published = await db.doc(`organizations/${organizationId}/websites/${websiteId}/content/published`).get();
    const fallback = fallbackValues(website.data() ?? {});
    const values = resolvePublishedWebsiteContent(fallback, published.exists ? published.data()?.values : undefined);
    const publicValues = await resolveMediaUrls(values, { organizationId, websiteId, customerId: String(website.data()?.customerId ?? ""), projectId: String(website.data()?.projectId ?? "") });
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    return res.json({ data: { organizationId, websiteId, version: Number(published.data()?.version ?? 0), publishedAt: published.data()?.updatedAt ?? null, source: published.exists && Number(published.data()?.version ?? 0) > 0 ? "published" : "fallback", values: publicValues } });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(404).json({ error: { code: "WEBSITE_NOT_FOUND", message: "Published website content was not found" } });
    return res.status(500).json({ error: { code: "PUBLISHED_CONTENT_UNAVAILABLE", message: "Published website content is temporarily unavailable" } });
  }
});

function fallbackValues(website: FirebaseFirestore.DocumentData): Record<string, unknown> {
  for (const key of ["defaultContent", "siteContent", "content"] as const) {
    const value = website[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return {};
}

async function resolveMediaUrls(values: Record<string, unknown>, scope: { organizationId: string; customerId: string; projectId: string; websiteId: string }) {
  const prefix = `organizations/${scope.organizationId}/website-media/${scope.customerId}/${scope.projectId}/${scope.websiteId}/`;
  const expires = Date.now() + 15 * 60_000;
  async function resolve(value: unknown): Promise<unknown> {
    if (typeof value === "string" && value.startsWith(prefix)) {
      const [url] = await storage.bucket().file(value).getSignedUrl({ action: "read", expires });
      return url;
    }
    if (Array.isArray(value)) return Promise.all(value.map(resolve));
    if (value && typeof value === "object") return Object.fromEntries(await Promise.all(Object.entries(value as Record<string, unknown>).map(async ([key, item]) => [key, await resolve(item)])));
    return value;
  }
  return await resolve(values) as Record<string, unknown>;
}
