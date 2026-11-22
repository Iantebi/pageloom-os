import { discoverySection, discoverySectionOrder, missingRequiredDiscoveryFields } from "@pageloom/core";
import { toRealSectionResponses } from "../services/discoveryMapping";
import type { DiscoveryData } from "../types";

// Client-side required-field gating for the AI Studio Discovery flow. Requiredness is never
// decided here — it comes from packages/core's discoveryTemplate via missingRequiredDiscoveryFields,
// the exact same function discovery-api.ts's /complete and /submit use as the real, non-bypassable
// gate (see that file's comment: "the client's own inline validation is advisory only" — this module
// is what turns it from advisory into a genuine step-blocker, without ever duplicating the rules).
//
// What this file adds on top of core: which AI-Studio STEP is responsible for answering each real
// question id, and which flat DiscoveryData field(s) to highlight for it. That mapping can't come
// from core (core has no concept of "AI Studio's step 4"), and can't be derived from section topic
// alone — e.g. presence.phone/presence.email are answered on step 1 (Business Identity), not step 7
// (Technical), because that's simply where AI Studio's own UI happens to ask for them.

/** Every required question id, grouped by the step whose own inputs actually answer it. */
const STEP_QUESTION_IDS: Record<number, readonly string[]> = {
  1: ["business.publicName", "presence.phone", "presence.email"],
  2: ["customers.idealCustomer", "customers.realProblem", "customers.desiredOutcome"],
  3: ["services.list"],
  4: ["differentiation.whyCustomersChoseYou"],
  5: ["branding.hasLogo", "branding.colors", "branding.style"],
  6: [],
  // presence.hasDomain is deliberately omitted here even though it's also required server-side —
  // it's driven by the exact same flat field (data.hasExistingDomain) as presence.hasWebsite, so
  // listing both would just show the same "missing" message twice for one checkbox.
  7: ["presence.hasWebsite"],
};

/** Which DiscoveryData field(s) to highlight when a question is missing. Two fields for one
 *  question (differentiation.whyCustomersChoseYou) because either satisfies it — see
 *  discoveryMapping.ts's joinNonEmpty(whyChooseYou, uniqueDifferentiator). */
const QUESTION_TO_FIELDS: Record<string, readonly (keyof DiscoveryData)[]> = {
  "business.publicName": ["businessName"],
  "presence.phone": ["phone"],
  "presence.email": ["email"],
  "customers.idealCustomer": ["idealCustomer"],
  "customers.realProblem": ["customerProblem"],
  "customers.desiredOutcome": ["customerDesire"],
  "services.list": ["services"],
  "differentiation.whyCustomersChoseYou": ["whyChooseYou", "uniqueDifferentiator"],
  "branding.hasLogo": ["logoStatus"],
  "branding.colors": ["brandColors"],
  "branding.style": ["brandStyle"],
  "presence.hasWebsite": ["hasExistingDomain"],
};

/** Hebrew label per missing question, for the review-step summary and validation banners. */
export const MISSING_FIELD_LABELS: Record<string, string> = {
  "business.publicName": "שם העסק",
  "presence.phone": "טלפון ראשי",
  "presence.email": "אימייל ליצירת קשר",
  "customers.idealCustomer": "הלקוח האידיאלי",
  "customers.realProblem": "הבעיה המרכזית של הלקוח",
  "customers.desiredOutcome": "התוצאה הרצויה לקהל",
  "services.list": "לפחות שירות אחד עם שם",
  "differentiation.whyCustomersChoseYou": "למה לקוחות בוחרים בכם (או מה מבדל אתכם)",
  "branding.hasLogo": "מצב הלוגו",
  "branding.colors": "צבע מותג אחד לפחות",
  "branding.style": "סגנון מיתוגי",
  "presence.hasWebsite": "האם קיים אתר/דומיין כיום",
};

function allMissingQuestionIds(data: DiscoveryData): Set<string> {
  const bySection = toRealSectionResponses(data);
  const missing = new Set<string>();
  for (const sectionId of discoverySectionOrder) {
    for (const id of missingRequiredDiscoveryFields(discoverySection(sectionId), bySection[sectionId] ?? {})) missing.add(id);
  }
  return missing;
}

/** Missing required question ids answerable from this specific step's own inputs. */
export function missingQuestionIdsForStep(step: number, data: DiscoveryData): string[] {
  const all = allMissingQuestionIds(data);
  return (STEP_QUESTION_IDS[step] ?? []).filter(id => all.has(id));
}

/** Flat DiscoveryData field names to highlight on this step. */
export function missingFieldsForStep(step: number, data: DiscoveryData): Set<keyof DiscoveryData> {
  const fields = new Set<keyof DiscoveryData>();
  for (const questionId of missingQuestionIdsForStep(step, data)) {
    for (const field of QUESTION_TO_FIELDS[questionId] ?? []) fields.add(field);
  }
  return fields;
}

/** Step 8 (Review) has no fields of its own — "can proceed" there means every required
 *  question across the whole Discovery is answered, not just one step's. */
export function canProceedFromStep(step: number, data: DiscoveryData): boolean {
  if (step === 8) return allMissingQuestionIds(data).size === 0;
  return missingQuestionIdsForStep(step, data).length === 0;
}

export function hasAnyMissingRequiredField(data: DiscoveryData): boolean {
  return allMissingQuestionIds(data).size > 0;
}

/** Every missing required question across the whole Discovery, with the step that answers it —
 *  used by the Review step's summary and by calculateDiscoveryStats. */
export function allMissingWithSteps(data: DiscoveryData): { step: number; questionId: string; labelHebrew: string }[] {
  const all = allMissingQuestionIds(data);
  const result: { step: number; questionId: string; labelHebrew: string }[] = [];
  for (const [step, questionIds] of Object.entries(STEP_QUESTION_IDS)) {
    for (const questionId of questionIds) {
      if (all.has(questionId)) result.push({ step: Number(step), questionId, labelHebrew: MISSING_FIELD_LABELS[questionId] ?? questionId });
    }
  }
  return result;
}
