import type { WorkflowStage } from "@pageloom/core";

// Maps the 22 internal WorkflowStage values (packages/core/src/workflow.ts) onto the 10
// customer-facing buckets from the PageLoom Customer Journey spec. This is a presentational
// simplification only — the underlying workflowStage remains the single source of truth;
// nothing here changes it. "Final approval" is derived from `customerApprovedAt` rather than
// a stage name, since approval is a moment (the CustomerApproved event, see workflow-engine.ts)
// that happens *inside* the customer_review→final_deployment transition, not a stage of its own.
export const customerJourneyBucketIds = ["payment_received", "website_brief", "materials", "building", "client_review", "revisions", "final_approval", "publishing", "live", "support"] as const;
export type CustomerJourneyBucketId = typeof customerJourneyBucketIds[number];

const buildingStages: readonly WorkflowStage[] = ["research", "brand_strategy", "design_system", "sitemap", "ux_planning", "ui_generation", "copywriting", "seo_optimization", "development", "deployment_preparation", "qa", "ceo_approval", "production_deployment"];

export function customerJourneyBucket(stage: WorkflowStage, customerApprovedAt: string | null | undefined): CustomerJourneyBucketId {
  if (stage === "completed") return "live";
  if (stage === "final_deployment") return "publishing";
  if (stage === "revision") return "revisions";
  if (stage === "customer_review") return customerApprovedAt ? "final_approval" : "client_review";
  if (buildingStages.includes(stage)) return "building";
  if (stage === "assets") return "materials";
  if (stage === "onboarding" || stage === "questionnaire") return "website_brief";
  return "payment_received";
}

type BucketCopy = { label: string; whatWereDoing: string; actionRequired: string; needsAction: boolean; nextStep: string };

const heCopy: Record<CustomerJourneyBucketId, BucketCopy> = {
  payment_received: { label: "התשלום התקבל", whatWereDoing: "פתחנו את הפרויקט שלכם ומתחילים בקליטה.", actionRequired: "אין צורך בפעולה כרגע.", needsAction: false, nextStep: "תקבלו הודעה עם קישור למילוי שאלון האתר." },
  website_brief: { label: "שאלון האתר", whatWereDoing: "ממתינים למילוי שאלון האתר.", actionRequired: "יש למלא את שאלון האתר.", needsAction: true, nextStep: "לאחר השליחה נעבור לאיסוף חומרים." },
  materials: { label: "איסוף חומרים", whatWereDoing: "בודקים אילו חומרים עוד חסרים.", actionRequired: "יש להעלות את כל החומרים החסרים.", needsAction: true, nextStep: "לאחר אימות החומרים תתחיל הבנייה." },
  building: { label: "בבנייה", whatWereDoing: "הצוות שלנו בונה את האתר שלכם.", actionRequired: "אין צורך בפעולה כרגע.", needsAction: false, nextStep: "תקבלו הודעה כשהתצוגה המקדימה תהיה מוכנה." },
  client_review: { label: "בדיקת הלקוח", whatWereDoing: "התצוגה המקדימה מוכנה ומחכה לבדיקתכם.", actionRequired: "יש לבדוק את האתר ולאשר או לבקש שינויים.", needsAction: true, nextStep: "לאחר האישור נמשיך לפרסום." },
  revisions: { label: "שינויים", whatWereDoing: "מבצעים את השינויים שביקשתם.", actionRequired: "אין צורך בפעולה כרגע.", needsAction: false, nextStep: "האתר יחזור לבדיקתכם לאחר ביצוע השינויים." },
  final_approval: { label: "אישור סופי", whatWereDoing: "האישור הסופי שלכם נרשם.", actionRequired: "אין צורך בפעולה כרגע.", needsAction: false, nextStep: "עוברים להכנות הפרסום." },
  publishing: { label: "פרסום", whatWereDoing: "מבצעים את רשימת הבדיקות לפני עלייה לאוויר.", actionRequired: "אין צורך בפעולה כרגע.", needsAction: false, nextStep: "האתר יעלה לאוויר בקרוב." },
  live: { label: "באוויר", whatWereDoing: "האתר שלכם באוויר!", actionRequired: "אין צורך בפעולה כרגע.", needsAction: false, nextStep: "מסירת הפרויקט ומידע על תמיכה." },
  support: { label: "תמיכה", whatWereDoing: "זמינים לכל שאלה או בקשה עתידית.", actionRequired: "פנו אלינו בכל צורך.", needsAction: false, nextStep: "—" },
};

const enCopy: Record<CustomerJourneyBucketId, BucketCopy> = {
  payment_received: { label: "Payment received", whatWereDoing: "We've opened your project and are starting onboarding.", actionRequired: "No action needed right now.", needsAction: false, nextStep: "You'll get a message with a link to your Website Brief." },
  website_brief: { label: "Website brief", whatWereDoing: "Waiting for your Website Brief.", actionRequired: "Please complete the Website Brief.", needsAction: true, nextStep: "Once submitted, we'll move to collecting materials." },
  materials: { label: "Materials", whatWereDoing: "Checking which materials are still missing.", actionRequired: "Please upload any missing materials.", needsAction: true, nextStep: "Building starts once materials are verified." },
  building: { label: "Building", whatWereDoing: "Our team is building your website.", actionRequired: "No action needed right now.", needsAction: false, nextStep: "You'll be notified when a preview is ready." },
  client_review: { label: "Client review", whatWereDoing: "A preview is ready and waiting for your review.", actionRequired: "Please review the site and approve or request changes.", needsAction: true, nextStep: "Once approved, we move to publishing." },
  revisions: { label: "Revisions", whatWereDoing: "Making the changes you requested.", actionRequired: "No action needed right now.", needsAction: false, nextStep: "The site will come back to you for review after changes." },
  final_approval: { label: "Final approval", whatWereDoing: "Your final approval has been recorded.", actionRequired: "No action needed right now.", needsAction: false, nextStep: "Moving on to launch preparation." },
  publishing: { label: "Publishing", whatWereDoing: "Running the pre-launch checklist.", actionRequired: "No action needed right now.", needsAction: false, nextStep: "Your site will go live shortly." },
  live: { label: "Live", whatWereDoing: "Your website is live!", actionRequired: "No action needed right now.", needsAction: false, nextStep: "Handover and support information." },
  support: { label: "Support", whatWereDoing: "We're here for any question or future request.", actionRequired: "Reach out anytime you need something.", needsAction: false, nextStep: "—" },
};

export const customerJourney = {
  he: { buckets: heCopy, eyebrow: "מסע הלקוח", welcomeTitle: "ברוכים הבאים ל-PageLoom", welcomeBody: "התשלום התקבל והפרויקט שלכם נפתח. נעדכן אתכם בכל שלב — ותמיד תדעו בדיוק מה קורה עם האתר שלכם.", welcomeCta: "למילוי שאלון האתר" },
  en: { buckets: enCopy, eyebrow: "Your journey", welcomeTitle: "Welcome to PageLoom", welcomeBody: "Payment received and your project is open. We'll keep you updated at every step — you'll always know exactly what's happening with your website.", welcomeCta: "Complete the Website Brief" },
} as const;
