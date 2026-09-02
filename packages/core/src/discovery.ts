import { z } from "zod";
import { discoverySectionOrder, type DiscoverySectionId } from "./discovery-template.js";

// API payload schemas and Firestore document shapes for Business Discovery. Kept separate
// from discovery-template.ts (which owns the fixed question structure and pure validation
// logic) so the template file never needs to import zod's I/O-boundary concerns. See
// docs/customer-discovery-onboarding/DATA-MODEL.md §2 for the full collection layout.

export const discoverySectionIdSchema = z.enum(discoverySectionOrder);

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const discoveryFileRecordSchema = z.object({
  path: z.string().min(1).max(1000),
  fileName: z.string().min(1).max(300),
  uploadedAt: z.string().datetime(),
  sizeBytes: z.number().int().nonnegative(),
  source: z.enum(["customer", "ai_generated"]).default("customer"),
});

export const discoveryServiceEntrySchema = z.object({
  name: z.string().min(1).max(200),
  forWhom: z.string().max(500).optional(),
  problem: z.string().max(1000).optional(),
  outcome: z.string().max(1000).optional(),
  priceLabel: z.string().max(120).optional(),
  promote: z.boolean().default(false),
});

export const discoveryTestimonialEntrySchema = z.object({
  text: z.string().min(1).max(2000),
  author: z.string().max(200).optional(),
  source: z.enum(["written", "google", "whatsapp", "screenshot"]).optional(),
});

export const discoveryAddressSchema = z.object({
  line1: z.string().min(1).max(300),
  city: z.string().min(1).max(120),
  serviceAreas: z.array(z.string().min(1).max(120)).max(30).optional(),
});

// One union covering every DiscoveryFieldType's response shape — short_text/long_text/
// email/phone/url/date all serialize as a plain string; select as a string; multi_select
// and social_links (a flat list of "platform:url" pairs, validated at the API layer against
// known platform keys) as a string array; boolean as boolean; color_pair as 1-2 hex codes;
// file/file_repeater, service_repeater, testimonial_repeater, and address as their own
// structured shapes.
export const discoveryResponseValueSchema = z.union([
  z.string().max(20000),
  z.boolean(),
  z.array(z.string().max(1000)).max(100),
  z.array(hexColorSchema).min(1).max(2),
  z.array(discoveryFileRecordSchema).max(20),
  z.array(discoveryServiceEntrySchema).max(20),
  z.array(discoveryTestimonialEntrySchema).max(10),
  discoveryAddressSchema,
]);

export const discoveryResponsesSchema = z.record(z.string(), discoveryResponseValueSchema);

export const saveDiscoverySectionSchema = z.object({
  organizationId: z.string().min(1),
  responses: discoveryResponsesSchema,
});

export const completeDiscoverySectionSchema = z.object({
  organizationId: z.string().min(1),
});

export const submitDiscoverySchema = z.object({
  organizationId: z.string().min(1),
});

export const reopenDiscoverySectionSchema = z.object({
  organizationId: z.string().min(1),
  reason: z.string().min(3).max(1000),
});

export const discoveryNoteSchema = z.object({
  organizationId: z.string().min(1),
  sectionId: discoverySectionIdSchema.optional(),
  body: z.string().min(1).max(2000),
});

// --- Firestore document shapes (DATA-MODEL.md §2) ---

export type DiscoverySectionStatus = "draft" | "completed";

export interface DiscoverySectionDocument {
  id: DiscoverySectionId;
  projectId: string;
  templateVersion: number;
  status: DiscoverySectionStatus;
  responses: Record<string, unknown>;
  updatedAt: string;
  updatedBy: string;
  completedAt?: string;
  completedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
}

export type DiscoveryProgressStatus = "not_started" | "in_progress" | "submitted" | "reviewed" | "reopened";

export interface DiscoveryProgressDocument {
  id: "current";
  projectId: string;
  templateVersion: number;
  status: DiscoveryProgressStatus;
  startedAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  currentSectionId?: DiscoverySectionId;
  completedSectionIds: DiscoverySectionId[];
  percentComplete: number;
  lastActivityAt: string;
}

export interface DiscoveryNoteDocument {
  id: string;
  projectId: string;
  sectionId?: DiscoverySectionId;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

// Schema-only in this release — no code path writes to this document yet.
// See PRD.md §25 and DATA-MODEL.md §4.
export interface BusinessProfileDocument {
  id: "current";
  projectId: string;
  status: "not_generated";
  schemaVersion: 1;
  businessProfile?: string;
  idealCustomer?: string;
  customerTrigger?: string;
  primaryPainPoints?: string[];
  secondaryPainPoints?: string[];
  desiredOutcomes?: string[];
  emotionalMotivations?: string[];
  buyingMotivations?: string[];
  commonObjections?: string[];
  trustBarriers?: string[];
  valueProposition?: string;
  differentiators?: string[];
  services?: { name: string; priority: boolean }[];
  priorityService?: string;
  proofSignals?: string[];
  currentAcquisitionChannels?: string[];
  customerJourney?: string;
  leadDropOffPoints?: string[];
  followUpProblems?: string[];
  automationOpportunities?: string[];
  primaryBusinessGoal?: string;
  kpis?: string[];
  businessCapacity?: string;
  recommendedCta?: string;
  recommendedPageStructure?: string[];
  recommendedContent?: string[];
  recommendedFaq?: { question: string; answer: string }[];
  recommendedSeoTopics?: string[];
  recommendedImages?: string[];
  recommendedAutomations?: string[];
  recommendedFutureImprovements?: string[];
  generatedAt?: string;
  generatedFromTemplateVersion?: number;
}
