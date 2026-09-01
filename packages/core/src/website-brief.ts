import { questionnaireFieldSchema } from "./client-management.js";
import type { z } from "zod";

// The "Website Brief" is not a new content system — it is a fixed, predefined set of
// `questionnaireFieldSchema` fields (the same generic field type already used for any
// project questionnaire) that gets auto-created via createQuestionnaireSchema the moment
// Owner confirms payment (see functions/src/onboarding-journey-api.ts). Reusing the existing
// questionnaire field types keeps the customer-facing form, its storage rules, and its
// completion/validation logic (validateRequiredQuestionnaireFields) unchanged — only the
// field *list* is new. Bulk photo/video collection happens later, in the separate Materials
// stage (the existing "assets" workflow stage), not here — this brief captures one
// representative logo/photo/video link plus everything needed to start the build.

export type WebsiteBriefField = z.infer<typeof questionnaireFieldSchema>;

export const websiteBriefTitle = "Website Brief";

export const websiteBriefFields: readonly WebsiteBriefField[] = [
  { id: "businessName", label: "Business name", type: "short_text", required: true },
  { id: "businessPhone", label: "Business phone", type: "phone", required: true },
  { id: "businessEmail", label: "Business email", type: "email", required: true },
  { id: "businessAddress", label: "Business address", type: "short_text", required: false },
  { id: "websiteGoal", label: "What is the main goal of the website?", type: "long_text", required: true, helpText: "e.g. generate leads, sell online, showcase a portfolio, build credibility." },
  { id: "targetAudience", label: "Who is the target audience?", type: "long_text", required: true },
  { id: "services", label: "Services / products", type: "long_text", required: true, helpText: "List each service or product on its own line." },
  { id: "businessDescription", label: "Describe the business", type: "long_text", required: true },
  { id: "advantages", label: "What makes this business different from competitors?", type: "long_text", required: false },
  { id: "testimonials", label: "Customer testimonials", type: "long_text", required: false, helpText: "Paste any existing testimonials you'd like included, one per line." },
  { id: "faqs", label: "Frequently asked questions", type: "long_text", required: false, helpText: "List common questions and their answers, one per line." },
  { id: "brandingNotes", label: "Branding style", type: "long_text", required: false, helpText: "Describe the look and feel you want (e.g. modern, warm, luxury, playful)." },
  { id: "brandColors", label: "Brand colors", type: "short_text", required: false, helpText: "List your brand colors, hex codes if you have them." },
  { id: "logo", label: "Logo file", type: "file", required: false },
  { id: "inspirationSites", label: "Inspiration websites", type: "long_text", required: false, helpText: "Links to websites you like, one per line." },
  { id: "introPhoto", label: "A representative photo", type: "file", required: false, helpText: "Bulk photos are collected in the next step (Materials)." },
  { id: "introVideo", label: "Intro video link", type: "url", required: false },
  { id: "socialLinks", label: "Social media links", type: "long_text", required: false, helpText: "Paste links to Facebook, Instagram, TikTok, etc., one per line." },
  { id: "googleBusinessUrl", label: "Google Business profile link", type: "url", required: false },
  { id: "whatsappNumber", label: "WhatsApp number", type: "phone", required: false },
  { id: "existingDomain", label: "Do you already own a domain?", type: "short_text", required: false },
  { id: "existingWebsiteUrl", label: "Existing website (if any)", type: "url", required: false },
  { id: "additionalNotes", label: "Anything else we should know?", type: "long_text", required: false },
] as const;
