import { defaultWebsiteContentValues, validateContentFieldValue, websiteContentFields } from "./website-content.js";

export type PublishedWebsiteContent = {
  websiteId: string;
  organizationId: string;
  version: number;
  publishedAt?: string;
  values: Record<string, unknown>;
  source: "published" | "fallback";
};

/**
 * Gradually adopts PageLoom-managed content without blanking an existing site.
 * Only known, valid fields from the published document can override site defaults.
 */
export function resolvePublishedWebsiteContent(
  fallback: Record<string, unknown> = {},
  published?: Record<string, unknown> | null,
): Record<string, unknown> {
  const values = { ...defaultWebsiteContentValues(), ...fallback };
  if (!published) return values;
  for (const field of websiteContentFields) {
    if (!(field.id in published)) continue;
    try { values[field.id] = validateContentFieldValue(field.id, published[field.id]); }
    catch { /* Ignore an invalid legacy value and retain the site's safe fallback. */ }
  }
  return values;
}

export type PublishedContentLoaderOptions = {
  baseUrl: string;
  organizationId: string;
  websiteId: string;
  fallback?: Record<string, unknown>;
  fetcher?: typeof fetch;
};

/** Reusable browser/server loader for every PageLoom customer website runtime. */
export async function loadPublishedWebsiteContent(options: PublishedContentLoaderOptions): Promise<PublishedWebsiteContent> {
  const fetcher = options.fetcher ?? fetch;
  const base = options.baseUrl.replace(/\/$/, "");
  const path = `${base}/api/public/organizations/${encodeURIComponent(options.organizationId)}/websites/${encodeURIComponent(options.websiteId)}/content`;
  try {
    const response = await fetcher(path, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Published content request failed (${response.status})`);
    const body = await response.json() as { data: Omit<PublishedWebsiteContent, "values"> & { values?: Record<string, unknown> } };
    return { ...body.data, values: resolvePublishedWebsiteContent(options.fallback, body.data.values) };
  } catch (error) {
    if (!options.fallback) throw error;
    return {
      websiteId: options.websiteId,
      organizationId: options.organizationId,
      version: 0,
      values: resolvePublishedWebsiteContent(options.fallback),
      source: "fallback",
    };
  }
}
