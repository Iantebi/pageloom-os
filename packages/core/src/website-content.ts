import { z } from "zod";

// Structured, reusable website-content model shared by every customer project.
// The section/field *schema* is fixed and versioned in code (not customer-defined),
// which keeps validation, permissions, and sanitization tractable while still scaling
// to any number of customer websites - only the *values* differ per project.

export const weekDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekDay = typeof weekDays[number];
export const socialPlatforms = ["facebook", "instagram", "linkedin", "twitter", "tiktok", "whatsapp", "youtube"] as const;
export type SocialPlatform = typeof socialPlatforms[number];

export const contentFieldTypeSchema = z.enum(["text", "long_text", "url", "boolean", "hours", "social_links", "image", "gallery", "videos", "testimonials", "services", "faq"]);
export type ContentFieldType = z.infer<typeof contentFieldTypeSchema>;
export const mediaFieldTypes: ReadonlySet<ContentFieldType> = new Set(["image", "gallery", "videos"]);

export interface ContentSectionDefinition { id: string; label: string; order: number }
export interface ContentFieldDefinition { id: string; sectionId: string; label: string; type: ContentFieldType; maxLength?: number; maxItems?: number; helpText?: string; customerEditableDefault: boolean }

export const websiteContentSections: readonly ContentSectionDefinition[] = [
  { id: "hero", label: "Hero", order: 1 },
  { id: "about", label: "About the business", order: 2 },
  { id: "contact", label: "Contact details", order: 3 },
  { id: "social", label: "Social links", order: 4 },
  { id: "services", label: "Services", order: 5 },
  { id: "gallery", label: "Gallery", order: 6 },
  { id: "videos", label: "Videos", order: 7 },
  { id: "testimonials", label: "Testimonials", order: 8 },
  { id: "faq", label: "FAQ", order: 9 },
  { id: "seo", label: "Search visibility", order: 10 },
];

export const websiteContentFields: readonly ContentFieldDefinition[] = [
  { id: "heroHeading", sectionId: "hero", label: "Hero heading", type: "text", maxLength: 120, customerEditableDefault: true },
  { id: "heroSubheading", sectionId: "hero", label: "Hero subheading", type: "text", maxLength: 200, customerEditableDefault: true },
  { id: "heroBody", sectionId: "hero", label: "Hero paragraph", type: "long_text", maxLength: 600, customerEditableDefault: true },
  { id: "heroImage", sectionId: "hero", label: "Hero image", type: "image", customerEditableDefault: true },
  { id: "ctaLabel", sectionId: "hero", label: "Call-to-action text", type: "text", maxLength: 40, customerEditableDefault: true },
  { id: "ctaUrl", sectionId: "hero", label: "Call-to-action link", type: "url", customerEditableDefault: true, helpText: "Where the primary button should lead, e.g. a phone, WhatsApp, or booking link." },
  { id: "aboutHeading", sectionId: "about", label: "About heading", type: "text", maxLength: 120, customerEditableDefault: true },
  { id: "aboutBody", sectionId: "about", label: "Business description", type: "long_text", maxLength: 3000, customerEditableDefault: true },
  { id: "phone", sectionId: "contact", label: "Phone number", type: "text", maxLength: 30, customerEditableDefault: true },
  { id: "email", sectionId: "contact", label: "Contact email", type: "text", maxLength: 120, customerEditableDefault: true },
  { id: "address", sectionId: "contact", label: "Business address", type: "text", maxLength: 300, customerEditableDefault: true },
  { id: "hours", sectionId: "contact", label: "Opening hours", type: "hours", customerEditableDefault: true },
  { id: "socialLinks", sectionId: "social", label: "Social links", type: "social_links", customerEditableDefault: true },
  { id: "services", sectionId: "services", label: "Services", type: "services", maxItems: 30, customerEditableDefault: true, helpText: "Prices are shown only if the Owner enables pricing for this site." },
  { id: "galleryImages", sectionId: "gallery", label: "Gallery images", type: "gallery", maxItems: 24, customerEditableDefault: true },
  { id: "videos", sectionId: "videos", label: "Videos", type: "videos", maxItems: 8, customerEditableDefault: true, helpText: "Upload a supported video file or paste a video link." },
  { id: "testimonials", sectionId: "testimonials", label: "Testimonials", type: "testimonials", maxItems: 20, customerEditableDefault: true },
  { id: "faqItems", sectionId: "faq", label: "FAQ", type: "faq", maxItems: 40, customerEditableDefault: true },
  { id: "seoTitle", sectionId: "seo", label: "SEO title", type: "text", maxLength: 70, customerEditableDefault: false, helpText: "Technical field. Owner-controlled by default." },
  { id: "seoDescription", sectionId: "seo", label: "SEO description", type: "long_text", maxLength: 160, customerEditableDefault: false, helpText: "Technical field. Owner-controlled by default." },
];

export const websiteContentFieldMap: ReadonlyMap<string, ContentFieldDefinition> = new Map(websiteContentFields.map(field => [field.id, field]));
export function contentField(fieldId: string): ContentFieldDefinition { const field = websiteContentFieldMap.get(fieldId); if (!field) throw new Error(`Unknown content field: ${fieldId}`); return field; }

const MIN_PRINTABLE_CODE = 32, TAB_CODE = 9, LF_CODE = 10, CR_CODE = 13;
function sanitizeText(value: string, maxLength: number): string {
  const withoutTags = value.replace(/<[^>]*>/g, "");
  let cleaned = "";
  for (const char of withoutTags) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= MIN_PRINTABLE_CODE || code === TAB_CODE || code === LF_CODE || code === CR_CODE) cleaned += char;
  }
  return cleaned.trim().slice(0, maxLength);
}
const testimonialSchema = z.object({ author: z.string().max(120), role: z.string().max(120).optional(), quote: z.string().max(1000) }).transform(value => ({ author: sanitizeText(value.author, 120), role: value.role ? sanitizeText(value.role, 120) : undefined, quote: sanitizeText(value.quote, 1000) }));
const serviceSchema = z.object({ title: z.string().max(120), description: z.string().max(600), priceLabel: z.string().max(60).optional() }).transform(value => ({ title: sanitizeText(value.title, 120), description: sanitizeText(value.description, 600), priceLabel: value.priceLabel ? sanitizeText(value.priceLabel, 60) : undefined }));
const faqSchema = z.object({ question: z.string().max(200), answer: z.string().max(2000) }).transform(value => ({ question: sanitizeText(value.question, 200), answer: sanitizeText(value.answer, 2000) }));
const hoursSchema = z.array(z.object({ day: z.enum(weekDays), open: z.string().max(10), close: z.string().max(10), closed: z.boolean().default(false) })).length(7);
const socialLinksSchema = z.record(z.enum(socialPlatforms), z.union([z.string().url(), z.literal("")]));
const videoSchema = z.object({ type: z.enum(["upload", "link"]), value: z.string().max(1000) });

/** Validates and sanitizes a raw value against a field's declared type. Throws on any mismatch - never trusts the caller. */
export function validateContentFieldValue(fieldId: string, value: unknown): unknown {
  const field = contentField(fieldId);
  switch (field.type) {
    case "text": return sanitizeText(z.string().max(field.maxLength ?? 200).parse(value), field.maxLength ?? 200);
    case "long_text": return sanitizeText(z.string().max(field.maxLength ?? 5000).parse(value), field.maxLength ?? 5000);
    case "url": { const text = z.string().trim().max(500).parse(value); return text === "" ? "" : z.string().url().parse(text); }
    case "boolean": return z.boolean().parse(value);
    case "hours": return hoursSchema.parse(value);
    case "social_links": return socialLinksSchema.parse(value);
    case "image": return z.string().max(1000).parse(value);
    case "gallery": return z.array(z.string().max(1000)).max(field.maxItems ?? 24).parse(value);
    case "videos": return z.array(videoSchema).max(field.maxItems ?? 8).parse(value);
    case "testimonials": return z.array(testimonialSchema).max(field.maxItems ?? 20).parse(value);
    case "services": return z.array(serviceSchema).max(field.maxItems ?? 30).parse(value);
    case "faq": return z.array(faqSchema).max(field.maxItems ?? 40).parse(value);
  }
}

export function defaultContentFieldValue(field: ContentFieldDefinition): unknown {
  switch (field.type) {
    case "boolean": return false;
    case "hours": return weekDays.map(day => ({ day, open: "09:00", close: "17:00", closed: day === "sat" || day === "sun" }));
    case "social_links": return {};
    case "gallery": case "videos": case "testimonials": case "services": case "faq": return [];
    default: return "";
  }
}
export function defaultWebsiteContentValues(): Record<string, unknown> { return Object.fromEntries(websiteContentFields.map(field => [field.id, defaultContentFieldValue(field)])); }
export function defaultContentPermissions(): Record<string, boolean> { return Object.fromEntries(websiteContentFields.map(field => [field.id, field.customerEditableDefault])); }

export interface WebsiteContentDocument { id: "draft" | "published"; values: Record<string, unknown>; updatedAt: string; updatedBy: string }
export interface WebsiteContentPermissions { id: "permissions"; publishMode: "direct" | "approval"; fields: Record<string, boolean>; showPrices: boolean; updatedAt: string; updatedBy: string }
export interface WebsiteContentSubmission { id: "current"; status: "pending" | "approved" | "rejected" | "changes_requested"; fieldIds: string[]; values: Record<string, unknown>; submittedBy: string; submittedAt: string; decidedBy?: string; decidedAt?: string; reason?: string }
export type ContentRevision =
  | { id: string; type: "field_change"; fieldId: string; previousValue: unknown; newValue: unknown; status: "draft" | "published" | "rejected"; actorId: string; actorRole: string; createdAt: string }
  | { id: string; type: "snapshot"; reason: "publish" | "approve" | "rollback"; values: Record<string, unknown>; actorId: string; actorRole: string; createdAt: string };

export const updateContentDraftSchema = z.object({ organizationId: z.string().min(1), changes: z.array(z.object({ fieldId: z.string().min(1), value: z.unknown() })).min(1).max(20) });
export const updateContentPermissionsSchema = z.object({ organizationId: z.string().min(1), publishMode: z.enum(["direct", "approval"]), showPrices: z.boolean().default(false), fields: z.record(z.string(), z.boolean()) });
export const publishContentSchema = z.object({ organizationId: z.string().min(1), fieldIds: z.array(z.string().min(1)).max(50).optional() });
export const submitContentSchema = z.object({ organizationId: z.string().min(1), fieldIds: z.array(z.string().min(1)).max(50).optional() });
export const rejectContentSchema = z.object({ organizationId: z.string().min(1), reason: z.string().min(3).max(1000) });
export const rollbackContentSchema = z.object({ organizationId: z.string().min(1), revisionId: z.string().min(1) });
export const registerContentMediaSchema = z.object({ organizationId: z.string().min(1), fieldId: z.string().min(1), path: z.string().min(1).max(1000), contentType: z.string().max(200), size: z.number().int().nonnegative() });
export const removeContentMediaSchema = z.object({ organizationId: z.string().min(1), fieldId: z.string().min(1), path: z.string().min(1).max(1000) });

export function canEditContentField(fieldId: string, isStaff: boolean, permissions: Record<string, boolean>): boolean { if (isStaff) return true; return permissions[fieldId] === true; }
