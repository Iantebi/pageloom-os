// Business Discovery ("אפיון העסק") — the 9-stage, AI-ready replacement for asking a
// customer to write their own headline/subheadline/CTA copy. Like websiteContentSections/
// websiteContentFields (website-content.ts) and websiteBriefFields (website-brief.ts), the
// section/question *structure* is fixed and versioned in code, not customer- or
// staff-editable — this keeps validation, conditional logic, and semantic tagging
// tractable. Only question *copy* (label / help text / "why we ask") lives outside this
// file, in the web app's i18n dictionaries, so a future English rollout never touches this
// file. See docs/customer-discovery-onboarding/DATA-MODEL.md §3 for the full rationale.
//
// This subsystem does not replace websiteBriefFields/createQuestionnaireSchema — both
// coexist. See docs/customer-discovery-onboarding/PRD.md §33 and §37.

export const DISCOVERY_TEMPLATE_VERSION = 1;

export const discoverySectionOrder = [
  "business", "customers", "services", "differentiation", "trust",
  "branding", "materials", "presence", "goals",
] as const;
export type DiscoverySectionId = typeof discoverySectionOrder[number];

export const discoveryFieldTypes = [
  "short_text", "long_text", "email", "phone", "url", "select", "multi_select",
  "boolean", "date", "color_pair", "file", "file_repeater",
  "service_repeater", "testimonial_repeater", "address", "social_links",
] as const;
export type DiscoveryFieldType = typeof discoveryFieldTypes[number];

// Every question must carry exactly one tag — this is what makes the collected data
// AI-ready without any AI code shipping in this release. See PRD.md §25, DATA-MODEL.md §4.
export const semanticTags = [
  "business_identity", "business_story", "ideal_customer", "customer_trigger",
  "pain_point", "desired_outcome", "emotional_motivation", "buying_motivation",
  "objection", "trust_barrier", "differentiator", "service", "priority_service",
  "proof_signal", "brand_style", "brand_color", "acquisition_channel",
  "business_goal", "kpi", "business_capacity", "cta_goal",
  "automation_opportunity", "contact_channel",
] as const;
export type SemanticTag = typeof semanticTags[number];

export interface DiscoveryCondition { questionId: string; equals?: string | boolean; notEmpty?: boolean }

export interface DiscoveryQuestion {
  id: string;
  sectionId: DiscoverySectionId;
  type: DiscoveryFieldType;
  required: boolean;
  semanticTag: SemanticTag;
  visibleIf?: readonly DiscoveryCondition[];
  options?: readonly string[];
  minItems?: number;
  maxItems?: number;
  maxLength?: number;
}

export interface DiscoverySectionDefinition {
  id: DiscoverySectionId;
  order: number;
  questions: readonly DiscoveryQuestion[];
}

export const discoveryTemplate: readonly DiscoverySectionDefinition[] = [
  {
    id: "business", order: 1, questions: [
      { id: "business.publicName", sectionId: "business", type: "short_text", required: true, semanticTag: "business_identity", maxLength: 200 },
      // whatItDoes and customerFeeling loosened to optional 2026-09-17 — see trust.hasTestimonials
      // comment further below; the unified Discovery frontend (AI Studio import) has no step that
      // asks either of these specifically, and a hard-required question with no UI path to answer
      // it would permanently block /submit for every customer using that frontend.
      { id: "business.whatItDoes", sectionId: "business", type: "long_text", required: false, semanticTag: "business_identity", maxLength: 3000 },
      { id: "business.story", sectionId: "business", type: "long_text", required: false, semanticTag: "business_story", maxLength: 3000 },
      { id: "business.founderPriorities", sectionId: "business", type: "long_text", required: false, semanticTag: "business_story", maxLength: 2000 },
      { id: "business.customerFeeling", sectionId: "business", type: "long_text", required: false, semanticTag: "business_identity", maxLength: 2000 },
      // Added 2026-09-17 for the Discovery frontend unification (AI Studio import): optional fields
      // that frontend collects with no prior home in this template. Additive only — every existing
      // consumer (Admin/Master Panel, server validation) is unaffected by an unanswered optional field.
      { id: "business.ownerName", sectionId: "business", type: "short_text", required: false, semanticTag: "business_identity", maxLength: 200 },
      { id: "business.category", sectionId: "business", type: "short_text", required: false, semanticTag: "business_identity", maxLength: 200 },
      { id: "business.tagline", sectionId: "business", type: "short_text", required: false, semanticTag: "business_identity", maxLength: 200 },
    ],
  },
  {
    id: "customers", order: 2, questions: [
      { id: "customers.idealCustomer", sectionId: "customers", type: "long_text", required: true, semanticTag: "ideal_customer", maxLength: 3000 },
      // Loosened to optional 2026-09-17 — see business.whatItDoes comment above.
      { id: "customers.beforeContact", sectionId: "customers", type: "long_text", required: false, semanticTag: "customer_trigger", maxLength: 2000 },
      { id: "customers.realProblem", sectionId: "customers", type: "long_text", required: true, semanticTag: "pain_point", maxLength: 2000 },
      { id: "customers.desiredOutcome", sectionId: "customers", type: "long_text", required: true, semanticTag: "desired_outcome", maxLength: 2000 },
      { id: "customers.commonFears", sectionId: "customers", type: "long_text", required: false, semanticTag: "objection", maxLength: 2000 },
      { id: "customers.ifUnsolved", sectionId: "customers", type: "long_text", required: false, semanticTag: "pain_point", maxLength: 2000 },
      // Added 2026-09-17 — see business.ownerName comment above.
      { id: "customers.obstacles", sectionId: "customers", type: "long_text", required: false, semanticTag: "objection", maxLength: 2000 },
    ],
  },
  {
    id: "services", order: 3, questions: [
      { id: "services.list", sectionId: "services", type: "service_repeater", required: true, semanticTag: "service", minItems: 1, maxItems: 20 },
    ],
  },
  {
    id: "differentiation", order: 4, questions: [
      { id: "differentiation.whyCustomersChoseYou", sectionId: "differentiation", type: "long_text", required: true, semanticTag: "differentiator", maxLength: 3000 },
      { id: "differentiation.whatCustomersSay", sectionId: "differentiation", type: "long_text", required: false, semanticTag: "proof_signal", maxLength: 2000 },
      // Loosened to optional 2026-09-17 — see business.whatItDoes comment above.
      {
        id: "differentiation.processAdvantages", sectionId: "differentiation", type: "multi_select", required: false, semanticTag: "differentiator",
        options: ["availability", "speed", "personal_service", "methodology", "guarantees", "transparency", "after_service", "expertise", "certifications"],
      },
      { id: "differentiation.other", sectionId: "differentiation", type: "long_text", required: false, semanticTag: "differentiator", maxLength: 2000 },
      // Added 2026-09-17 — see business.ownerName comment above.
      { id: "differentiation.corePromises", sectionId: "differentiation", type: "long_text", required: false, semanticTag: "differentiator", maxLength: 2000 },
      { id: "differentiation.guarantees", sectionId: "differentiation", type: "long_text", required: false, semanticTag: "differentiator", maxLength: 2000 },
    ],
  },
  {
    id: "trust", order: 5, questions: [
      // hasTestimonials loosened to optional 2026-09-17: the unified Discovery frontend (AI Studio
      // import) has no step that asks this, and a hard-required question with no UI path to answer
      // it would permanently block /submit for every customer using that frontend. The question and
      // its server-side validation stay in place for any other consumer that does ask it.
      { id: "trust.hasTestimonials", sectionId: "trust", type: "boolean", required: false, semanticTag: "proof_signal" },
      { id: "trust.testimonials", sectionId: "trust", type: "testimonial_repeater", required: false, semanticTag: "proof_signal", maxItems: 10, visibleIf: [{ questionId: "trust.hasTestimonials", equals: true }] },
      { id: "trust.wantsHelpCollecting", sectionId: "trust", type: "boolean", required: false, semanticTag: "proof_signal", visibleIf: [{ questionId: "trust.hasTestimonials", equals: false }] },
      { id: "trust.yearsExperience", sectionId: "trust", type: "short_text", required: false, semanticTag: "proof_signal", maxLength: 60 },
      { id: "trust.clientCount", sectionId: "trust", type: "short_text", required: false, semanticTag: "proof_signal", maxLength: 60 },
      { id: "trust.certifications", sectionId: "trust", type: "long_text", required: false, semanticTag: "proof_signal", maxLength: 1500 },
      // Added 2026-09-17 — file-based equivalents of certifications/testimonials (a certificate scan,
      // a screenshot of a review) that the unified frontend's uploads step collects but the text-only
      // fields above can't hold.
      { id: "trust.certificationFiles", sectionId: "trust", type: "file_repeater", required: false, semanticTag: "proof_signal", maxItems: 10 },
      { id: "trust.testimonialFiles", sectionId: "trust", type: "file_repeater", required: false, semanticTag: "proof_signal", maxItems: 10 },
    ],
  },
  {
    id: "branding", order: 6, questions: [
      { id: "branding.hasLogo", sectionId: "branding", type: "boolean", required: true, semanticTag: "brand_style" },
      { id: "branding.logo", sectionId: "branding", type: "file", required: false, semanticTag: "brand_style", visibleIf: [{ questionId: "branding.hasLogo", equals: true }] },
      { id: "branding.colors", sectionId: "branding", type: "color_pair", required: true, semanticTag: "brand_color", minItems: 1, maxItems: 2, options: ["blue", "black", "white", "green", "gold", "beige", "grey", "custom"] },
      {
        id: "branding.style", sectionId: "branding", type: "multi_select", required: true, semanticTag: "brand_style",
        options: ["modern", "premium", "clean_minimal", "warm_friendly", "young_dynamic", "professional", "innovative", "calm"],
      },
      { id: "branding.avoid", sectionId: "branding", type: "long_text", required: false, semanticTag: "brand_style", maxLength: 1000 },
      // Added 2026-09-17 — see business.ownerName comment above.
      { id: "branding.fontStyle", sectionId: "branding", type: "short_text", required: false, semanticTag: "brand_style", maxLength: 200 },
      { id: "branding.inspirationWebsites", sectionId: "branding", type: "long_text", required: false, semanticTag: "brand_style", maxLength: 1000 },
      // Free-text personality phrases from a source with its own open-ended vocabulary — kept
      // verbatim rather than force-mapped onto branding.style's fixed options, which would lose or
      // misrepresent intent for a phrase that doesn't cleanly match any single option.
      { id: "branding.personalityTraits", sectionId: "branding", type: "long_text", required: false, semanticTag: "brand_style", maxLength: 1000 },
    ],
  },
  {
    id: "materials", order: 7, questions: [
      { id: "materials.ownerPhotos", sectionId: "materials", type: "file_repeater", required: false, semanticTag: "proof_signal", maxItems: 5 },
      { id: "materials.teamPhotos", sectionId: "materials", type: "file_repeater", required: false, semanticTag: "proof_signal", maxItems: 5 },
      { id: "materials.locationPhotos", sectionId: "materials", type: "file_repeater", required: false, semanticTag: "proof_signal", maxItems: 5 },
      { id: "materials.productPhotos", sectionId: "materials", type: "file_repeater", required: false, semanticTag: "proof_signal", maxItems: 10 },
      { id: "materials.priceListOrBrochure", sectionId: "materials", type: "file_repeater", required: false, semanticTag: "service", maxItems: 3 },
      // Added 2026-09-17 — catch-all for uploads that don't fit an existing category (the unified
      // frontend's generic "docs" upload category).
      { id: "materials.otherDocuments", sectionId: "materials", type: "file_repeater", required: false, semanticTag: "service", maxItems: 10 },
    ],
  },
  {
    id: "presence", order: 8, questions: [
      { id: "presence.phone", sectionId: "presence", type: "phone", required: true, semanticTag: "contact_channel" },
      { id: "presence.whatsapp", sectionId: "presence", type: "phone", required: false, semanticTag: "contact_channel" },
      { id: "presence.email", sectionId: "presence", type: "email", required: true, semanticTag: "contact_channel" },
      { id: "presence.address", sectionId: "presence", type: "address", required: false, semanticTag: "contact_channel" },
      { id: "presence.hours", sectionId: "presence", type: "short_text", required: false, semanticTag: "contact_channel", maxLength: 500 },
      { id: "presence.serviceAreas", sectionId: "presence", type: "long_text", required: false, semanticTag: "contact_channel", maxLength: 1000 },
      { id: "presence.hasWebsite", sectionId: "presence", type: "boolean", required: true, semanticTag: "acquisition_channel" },
      { id: "presence.existingWebsiteUrl", sectionId: "presence", type: "url", required: false, semanticTag: "acquisition_channel", visibleIf: [{ questionId: "presence.hasWebsite", equals: true }] },
      { id: "presence.hasDomain", sectionId: "presence", type: "boolean", required: true, semanticTag: "acquisition_channel" },
      { id: "presence.socialLinks", sectionId: "presence", type: "social_links", required: false, semanticTag: "acquisition_channel" },
      { id: "presence.googleBusinessUrl", sectionId: "presence", type: "url", required: false, semanticTag: "acquisition_channel" },
      // Added 2026-09-17 — see business.ownerName comment above.
      { id: "presence.needsDomainHelp", sectionId: "presence", type: "boolean", required: false, semanticTag: "acquisition_channel" },
    ],
  },
  {
    id: "goals", order: 9, questions: [
      // All four loosened to optional 2026-09-17 — see trust.hasTestimonials comment above; the
      // unified frontend's Review/Completion steps collect no data of their own (they only summarize
      // and finalize), so nothing in that frontend can ever answer these.
      { id: "goals.biggestProblem", sectionId: "goals", type: "long_text", required: false, semanticTag: "business_goal", maxLength: 2000 },
      { id: "goals.sixMonthSuccess", sectionId: "goals", type: "long_text", required: false, semanticTag: "kpi", maxLength: 2000 },
      {
        id: "goals.priorityOutcomes", sectionId: "goals", type: "multi_select", required: false, semanticTag: "business_goal",
        options: ["more_inquiries", "better_leads", "more_customers", "more_sales", "more_trust", "better_google_visibility", "easier_bookings", "less_manual_work", "better_follow_up", "better_digital_presence"],
      },
      { id: "goals.capacityCheck", sectionId: "goals", type: "long_text", required: false, semanticTag: "business_capacity", maxLength: 1000 },
    ],
  },
];

export const discoveryQuestionMap: ReadonlyMap<string, DiscoveryQuestion> = new Map(
  discoveryTemplate.flatMap(section => section.questions.map(question => [question.id, question] as const)),
);
export function discoveryQuestion(questionId: string): DiscoveryQuestion {
  const question = discoveryQuestionMap.get(questionId);
  if (!question) throw new Error(`Unknown discovery question: ${questionId}`);
  return question;
}
export function discoverySection(sectionId: DiscoverySectionId): DiscoverySectionDefinition {
  const section = discoveryTemplate.find(candidate => candidate.id === sectionId);
  if (!section) throw new Error(`Unknown discovery section: ${sectionId}`);
  return section;
}

export type DiscoveryResponses = Record<string, unknown>;

/** Single source of truth for conditional visibility — used both client-side (render) and
 *  server-side (required-field validation). See PRD.md §11. */
export function isQuestionVisible(question: DiscoveryQuestion, responses: DiscoveryResponses): boolean {
  if (!question.visibleIf?.length) return true;
  return question.visibleIf.every(condition => {
    const value = responses[condition.questionId];
    if (condition.equals !== undefined) return value === condition.equals;
    if (condition.notEmpty) return value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
    return true;
  });
}

// Deliberately does NOT treat `false` as empty: a raw response value of `false` only ever comes
// from a boolean-type question (see DiscoveryResponseValue in discovery.ts — no other question
// type serializes to a bare boolean), and "No" is a complete, meaningful answer to a required
// boolean question (trust.hasTestimonials, branding.hasLogo, presence.hasWebsite,
// presence.hasDomain), not a missing one. The generic client-management.ts questionnaire helper
// this was originally modeled on has the same `value === false` check, but it has never been
// exercised there because no Website Brief field is boolean-typed — Discovery is the first
// consumer to actually have a required boolean question, which is what surfaced this.
function isEmptyResponse(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  return Array.isArray(value) && value.length === 0;
}

/** Mirrors client-management.ts's missingRequiredQuestionnaireFields — extended with
 *  conditional-visibility awareness (a hidden required question is never "missing"). */
export function missingRequiredDiscoveryFields(section: DiscoverySectionDefinition, responses: DiscoveryResponses): string[] {
  return section.questions
    .filter(question => question.required && isQuestionVisible(question, responses))
    .filter(question => isEmptyResponse(responses[question.id]))
    .map(question => question.id);
}

export function isSectionComplete(section: DiscoverySectionDefinition, responses: DiscoveryResponses): boolean {
  return missingRequiredDiscoveryFields(section, responses).length === 0;
}

// Format validation for email/phone/url-typed answers (2026-09-16). A native
// <input type="email"|"tel"|"url"> only advises the browser's own UI — it never actually stops a
// malformed value from reaching the server, and discovery-api.ts previously accepted any string up
// to discoveryResponsesSchema's generic 20000-char cap for these fields. Deliberately permissive
// (not a strict RFC-5322/E.164 parser): the goal is catching an obviously-wrong value ("no",
// "asdf"), not rejecting a legitimately-formatted phone number this regex doesn't happen to expect.
const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneFormat = /^[\d\s+()-]{7,20}$/;
const urlFormat = /^https?:\/\/.+/;

function hasFormatIssue(question: DiscoveryQuestion, value: unknown): boolean {
  if (typeof value !== "string" || value === "") return false; // empty is a required-field concern, not a format one
  if (question.type === "email") return !emailFormat.test(value);
  if (question.type === "phone") return !phoneFormat.test(value);
  if (question.type === "url") return !urlFormat.test(value);
  return false;
}

/** Mirrors missingRequiredDiscoveryFields's shape and conditional-visibility awareness, but for
 *  format rather than presence — a question that's optional-and-empty is fine; a question that's
 *  optional-but-filled-with-garbage is not. Used both client-side (inline feedback before save) and
 *  server-side (discovery-api.ts's /complete and /submit — the real, non-bypassable gate). */
export function invalidDiscoveryFieldFormats(section: DiscoverySectionDefinition, responses: DiscoveryResponses): string[] {
  return section.questions
    .filter(question => isQuestionVisible(question, responses))
    .filter(question => hasFormatIssue(question, responses[question.id]))
    .map(question => question.id);
}

/** Meaningful-completion percentage — only sections explicitly marked complete count.
 *  See PRD.md §13. */
export function discoveryProgressPercent(completedSectionIds: readonly DiscoverySectionId[]): number {
  const uniqueCompleted = new Set(completedSectionIds);
  return Math.round((uniqueCompleted.size / discoverySectionOrder.length) * 100);
}
