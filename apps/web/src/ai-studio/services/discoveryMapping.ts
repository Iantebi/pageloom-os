import type { DiscoverySectionId } from "@pageloom/core";
import type { BrandColors, DiscoveryData, ServiceItem, UploadedFile } from "../types";

// Bridges the AI Studio frontend's flat DiscoveryData shape onto pageloom-os's real, deployed
// Discovery schema (packages/core/src/discovery-template.ts) — nine section documents, each with
// its own fixed question IDs, served through the real backend (functions/src/discovery-api.ts).
// This is the ONLY place that knows both shapes; everything else (App.tsx, the Step components)
// keeps using AI Studio's own DiscoveryData exactly as designed.
//
// Why a mapping layer instead of changing the real schema to match AI Studio: the real schema is
// shared with Admin/Master Panel and already has real customer data behind it. A few fields with no
// prior home were added to it (see discovery-template.ts's 2026-09-17 comments) - additive only,
// nothing removed or renamed.

export type SectionResponsesMap = Partial<Record<DiscoverySectionId, Record<string, unknown>>>;

type RealFileRecord = { path: string; fileName: string; uploadedAt: string; sizeBytes: number; source: "customer" | "ai_generated" };
type RealServiceEntry = { name: string; forWhom?: string; problem?: string; outcome?: string; priceLabel?: string; promote: boolean };
type RealAddress = { line1: string; city: string; serviceAreas?: string[] };

// AI Studio's brand-style presets (see ai-studio/data/initialData.ts's BRAND_STYLE_PRESETS ids)
// mapped onto the real branding.style question's fixed multi_select vocabulary. Best-effort: each
// preset maps to the closest one or two real options, since the two vocabularies were designed
// independently and don't correspond 1:1.
const BRAND_STYLE_TO_REAL: Record<string, string[]> = {
  modern_minimal: ["modern", "clean_minimal"],
  warm_friendly: ["warm_friendly"],
  luxury_prestige: ["premium"],
  bold_dynamic: ["young_dynamic", "innovative"],
  natural_organic: ["calm"],
  corporate_trust: ["professional"],
};

const FILE_CATEGORY_TO_QUESTION: Record<UploadedFile["category"], { sectionId: DiscoverySectionId; questionId: string } | null> = {
  logo: { sectionId: "branding", questionId: "branding.logo" },
  owner_photo: { sectionId: "materials", questionId: "materials.ownerPhotos" },
  business_photos: { sectionId: "materials", questionId: "materials.locationPhotos" },
  products: { sectionId: "materials", questionId: "materials.productPhotos" },
  services: { sectionId: "materials", questionId: "materials.productPhotos" },
  certificates: { sectionId: "trust", questionId: "trust.certificationFiles" },
  recommendations: { sectionId: "trust", questionId: "trust.testimonialFiles" },
  price_list: { sectionId: "materials", questionId: "materials.priceListOrBrochure" },
  docs: { sectionId: "materials", questionId: "materials.otherDocuments" },
};

function toRealFile(file: UploadedFile): RealFileRecord | undefined {
  // Only a file that has actually gone through the real upload path
  // (firebaseDiscoveryService.uploadClientFile) carries a Storage `path` and a real ISO
  // timestamp — a file still mid-upload, or one that failed and never got either, is
  // deliberately not persisted to the real backend yet (nothing valid to point at).
  // realUploadedAtIso (not the display-only file.uploadedAt, a localized Hebrew string) is
  // what satisfies discoveryFileRecordSchema's `.datetime()` requirement.
  const typed = file as UploadedFile & { realPath?: string; realUploadedAtIso?: string };
  if (!typed.realPath || !typed.realUploadedAtIso || file.isDeleted) return undefined;
  return { path: typed.realPath, fileName: file.name, uploadedAt: typed.realUploadedAtIso, sizeBytes: file.size, source: "customer" };
}

function joinNonEmpty(...parts: (string | undefined)[]): string | undefined {
  const joined = parts.filter(part => part && part.trim()).join(" | ");
  return joined || undefined;
}

/** AI Studio DiscoveryData -> the real backend's per-section responses shape. Called on every
 *  autosave; only sections with at least one non-empty answer are returned, so an untouched
 *  section never gets a premature empty document written for it. */
export function toRealSectionResponses(data: DiscoveryData): SectionResponsesMap {
  const filesByQuestion = new Map<string, RealFileRecord[]>();
  for (const file of data.uploadedFiles ?? []) {
    const target = FILE_CATEGORY_TO_QUESTION[file.category];
    if (!target) continue;
    const record = toRealFile(file);
    if (!record) continue;
    const list = filesByQuestion.get(target.questionId) ?? [];
    list.push(record);
    filesByQuestion.set(target.questionId, list);
  }

  const services: RealServiceEntry[] = (data.services ?? [])
    .filter(service => service.name?.trim())
    .map((service: ServiceItem): RealServiceEntry => ({
      name: service.name,
      forWhom: service.targetAudience,
      problem: service.problemSolved,
      outcome: joinNonEmpty(service.resultReceived, service.whyValuable ? `למה זה שווה: ${service.whyValuable}` : undefined),
      priceLabel: service.priceEstimate,
      promote: false,
    }));

  // discoveryAddressSchema requires city to be non-empty (min(1)) — AI Studio has no separate
  // city field, only one combined address string, so there is no real value to put there. A
  // placeholder is honest about that rather than duplicating line1 into it.
  const address: RealAddress | undefined = (data.physicalAddress || data.location)
    ? { line1: data.physicalAddress || data.location, city: "לא צוין" }
    : undefined;

  const socialLinks = [data.facebookUrl, data.instagramUrl, data.tiktokOrLinkedIn].filter((url): url is string => Boolean(url?.trim()));
  const colors = (data.brandColors as BrandColors | undefined);
  const colorPair = colors ? [colors.primary, colors.secondary].filter(Boolean) : [];

  const business: Record<string, unknown> = {
    "business.publicName": data.businessName || undefined,
    "business.whatItDoes": joinNonEmpty(data.businessCategory, data.businessStory) || undefined,
    "business.story": data.businessStory || undefined,
    "business.ownerName": data.ownerName || undefined,
    "business.category": data.businessCategory || undefined,
    "business.tagline": data.tagline || undefined,
  };

  const customers: Record<string, unknown> = {
    "customers.idealCustomer": data.idealCustomer || undefined,
    "customers.realProblem": data.customerProblem || undefined,
    "customers.desiredOutcome": data.customerDesire || undefined,
    "customers.commonFears": data.customerFears || undefined,
    "customers.obstacles": data.customerObstacles || undefined,
  };

  const differentiation: Record<string, unknown> = {
    "differentiation.whyCustomersChoseYou": joinNonEmpty(data.whyChooseYou, data.uniqueDifferentiator),
    "differentiation.whatCustomersSay": data.socialProof || undefined,
    "differentiation.corePromises": data.corePromises || undefined,
    "differentiation.guarantees": data.guarantees || undefined,
  };

  const trust: Record<string, unknown> = {
    "trust.yearsExperience": data.yearsInBusiness || undefined,
    "trust.certifications": joinNonEmpty(data.experienceSummary, data.awardsAndCertifications),
    "trust.certificationFiles": filesByQuestion.get("trust.certificationFiles"),
    "trust.testimonialFiles": filesByQuestion.get("trust.testimonialFiles"),
  };

  const styleOptions = data.brandStyle ? (BRAND_STYLE_TO_REAL[data.brandStyle] ?? []) : [];
  const branding: Record<string, unknown> = {
    "branding.hasLogo": data.logoStatus ? data.logoStatus !== "needs_new_logo" : undefined,
    "branding.logo": filesByQuestion.get("branding.logo"),
    "branding.colors": colorPair.length ? colorPair : undefined,
    "branding.style": styleOptions.length ? styleOptions : undefined,
    "branding.fontStyle": data.fontStyle || undefined,
    "branding.inspirationWebsites": data.inspirationWebsites || undefined,
    "branding.personalityTraits": (data.brandPersonality ?? []).length ? data.brandPersonality.join(", ") : undefined,
  };

  const materials: Record<string, unknown> = {
    "materials.ownerPhotos": filesByQuestion.get("materials.ownerPhotos"),
    "materials.teamPhotos": filesByQuestion.get("materials.teamPhotos"),
    "materials.locationPhotos": filesByQuestion.get("materials.locationPhotos"),
    "materials.productPhotos": filesByQuestion.get("materials.productPhotos"),
    "materials.priceListOrBrochure": filesByQuestion.get("materials.priceListOrBrochure"),
    "materials.otherDocuments": filesByQuestion.get("materials.otherDocuments"),
  };

  const presence: Record<string, unknown> = {
    "presence.phone": data.phone || undefined,
    "presence.whatsapp": data.whatsapp || undefined,
    "presence.email": data.email || data.businessEmail || undefined,
    "presence.address": address,
    "presence.hours": data.openingHours || undefined,
    "presence.hasWebsite": data.hasExistingDomain,
    "presence.existingWebsiteUrl": data.existingDomain ? (/^https?:\/\//.test(data.existingDomain) ? data.existingDomain : `https://${data.existingDomain}`) : undefined,
    "presence.hasDomain": data.hasExistingDomain,
    "presence.socialLinks": socialLinks.length ? socialLinks : undefined,
    "presence.googleBusinessUrl": data.googleMapsUrl || undefined,
    "presence.needsDomainHelp": data.needsDomainHelp,
  };

  const bySection: SectionResponsesMap = { business, customers, services: { "services.list": services.length ? services : undefined }, differentiation, trust, branding, materials, presence };

  const nonEmpty: SectionResponsesMap = {};
  for (const [sectionId, responses] of Object.entries(bySection) as [DiscoverySectionId, Record<string, unknown>][]) {
    const cleaned = Object.fromEntries(Object.entries(responses).filter(([, value]) => value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0)));
    if (Object.keys(cleaned).length > 0) nonEmpty[sectionId] = cleaned;
  }
  return nonEmpty;
}

/** The reverse direction — real per-section responses (as returned by GET
 *  /projects/:id/discovery) merged onto an AI Studio DiscoveryData base, used when resuming a
 *  session. Only fields the real backend actually has values for are overwritten; everything
 *  else keeps whatever the caller's base (usually INITIAL_DISCOVERY_DATA) already had. */
export function applyRealSectionResponses(base: DiscoveryData, sections: Partial<Record<DiscoverySectionId, Record<string, unknown>>>): DiscoveryData {
  const next: DiscoveryData = { ...base };
  const business = sections.business ?? {};
  const customers = sections.customers ?? {};
  const services = sections.services ?? {};
  const differentiation = sections.differentiation ?? {};
  const trust = sections.trust ?? {};
  const branding = sections.branding ?? {};
  const materials = sections.materials ?? {};
  const presence = sections.presence ?? {};

  if (business["business.publicName"]) next.businessName = String(business["business.publicName"]);
  if (business["business.ownerName"]) next.ownerName = String(business["business.ownerName"]);
  if (business["business.category"]) next.businessCategory = String(business["business.category"]);
  if (business["business.story"]) next.businessStory = String(business["business.story"]);
  if (business["business.tagline"]) next.tagline = String(business["business.tagline"]);

  if (customers["customers.idealCustomer"]) next.idealCustomer = String(customers["customers.idealCustomer"]);
  if (customers["customers.realProblem"]) next.customerProblem = String(customers["customers.realProblem"]);
  if (customers["customers.desiredOutcome"]) next.customerDesire = String(customers["customers.desiredOutcome"]);
  if (customers["customers.commonFears"]) next.customerFears = String(customers["customers.commonFears"]);
  if (customers["customers.obstacles"]) next.customerObstacles = String(customers["customers.obstacles"]);

  const serviceList = services["services.list"];
  if (Array.isArray(serviceList)) {
    next.services = (serviceList as RealServiceEntry[]).map((entry, index): ServiceItem => ({
      id: `svc-${index}`, name: entry.name ?? "", problemSolved: entry.problem ?? "", resultReceived: entry.outcome ?? "",
      whyValuable: "", targetAudience: entry.forWhom, priceEstimate: entry.priceLabel,
    }));
  }

  if (differentiation["differentiation.whyCustomersChoseYou"]) next.whyChooseYou = String(differentiation["differentiation.whyCustomersChoseYou"]);
  if (differentiation["differentiation.whatCustomersSay"]) next.socialProof = String(differentiation["differentiation.whatCustomersSay"]);
  if (differentiation["differentiation.corePromises"]) next.corePromises = String(differentiation["differentiation.corePromises"]);
  if (differentiation["differentiation.guarantees"]) next.guarantees = String(differentiation["differentiation.guarantees"]);

  if (trust["trust.yearsExperience"]) next.yearsInBusiness = String(trust["trust.yearsExperience"]);
  if (trust["trust.certifications"]) next.awardsAndCertifications = String(trust["trust.certifications"]);

  if (branding["branding.hasLogo"] !== undefined) next.logoStatus = branding["branding.hasLogo"] ? "has_logo" : "needs_new_logo";
  const colors = branding["branding.colors"];
  if (Array.isArray(colors) && colors.length) next.brandColors = { primary: String(colors[0]), secondary: String(colors[1] ?? colors[0]) };
  if (branding["branding.fontStyle"]) next.fontStyle = String(branding["branding.fontStyle"]);
  if (branding["branding.inspirationWebsites"]) next.inspirationWebsites = String(branding["branding.inspirationWebsites"]);
  if (typeof branding["branding.personalityTraits"] === "string") next.brandPersonality = String(branding["branding.personalityTraits"]).split(",").map(item => item.trim()).filter(Boolean);

  if (presence["presence.phone"]) next.phone = String(presence["presence.phone"]);
  if (presence["presence.whatsapp"]) next.whatsapp = String(presence["presence.whatsapp"]);
  if (presence["presence.email"]) next.email = String(presence["presence.email"]);
  const address = presence["presence.address"] as RealAddress | undefined;
  if (address?.line1) { next.physicalAddress = address.line1; next.location = address.line1; }
  if (presence["presence.hours"]) next.openingHours = String(presence["presence.hours"]);
  if (presence["presence.hasDomain"] !== undefined) next.hasExistingDomain = Boolean(presence["presence.hasDomain"]);
  if (presence["presence.existingWebsiteUrl"]) next.existingDomain = String(presence["presence.existingWebsiteUrl"]);
  if (presence["presence.needsDomainHelp"] !== undefined) next.needsDomainHelp = Boolean(presence["presence.needsDomainHelp"]);
  const links = presence["presence.socialLinks"];
  if (Array.isArray(links)) { next.facebookUrl = links.find(link => /facebook/i.test(String(link))) ?? next.facebookUrl; next.instagramUrl = links.find(link => /instagram/i.test(String(link))) ?? next.instagramUrl; }
  if (presence["presence.googleBusinessUrl"]) next.googleMapsUrl = String(presence["presence.googleBusinessUrl"]);

  const filesFromSections: UploadedFile[] = [];
  const collectFiles = (records: unknown, category: UploadedFile["category"], labelHe: string) => {
    if (!Array.isArray(records)) return;
    for (const record of records as RealFileRecord[]) {
      filesFromSections.push({ id: record.path, name: record.fileName, size: record.sizeBytes, type: "application/octet-stream", category, categoryLabelHebrew: labelHe, downloadUrl: "", uploadedAt: record.uploadedAt, progress: 100, isDeleted: false, ...( { realPath: record.path } as Record<string, unknown>) } as UploadedFile);
    }
  };
  collectFiles(branding["branding.logo"], "logo", "לוגו");
  collectFiles(materials["materials.ownerPhotos"], "owner_photo", "תמונות בעל העסק");
  collectFiles(materials["materials.locationPhotos"], "business_photos", "תמונות העסק");
  collectFiles(materials["materials.productPhotos"], "products", "תמונות מוצרים");
  collectFiles(materials["materials.priceListOrBrochure"], "price_list", "מחירון");
  collectFiles(materials["materials.otherDocuments"], "docs", "קבצים נוספים");
  collectFiles(trust["trust.certificationFiles"], "certificates", "תעודות");
  collectFiles(trust["trust.testimonialFiles"], "recommendations", "המלצות");
  if (filesFromSections.length) next.uploadedFiles = filesFromSections;

  return next;
}
