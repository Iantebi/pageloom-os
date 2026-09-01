import { z } from "zod";

// Structured revision requests — replaces "scattered WhatsApp messages" with a recorded,
// resolvable, per-project history. This sits alongside the existing customer_review/revision
// workflow stages and the CustomerRequestedRevision workflow event (which still drives the
// project's overall stage) — a revision *request* is the structured detail of what the
// customer is asking for, while the workflow event remains the stage-transition signal.
export const revisionRequestStatusSchema = z.enum(["open", "resolved"]);
export type RevisionRequestStatus = z.infer<typeof revisionRequestStatusSchema>;

export interface RevisionRequest {
  id: string;
  projectId: string;
  description: string;
  area?: string;
  status: RevisionRequestStatus;
  createdBy: string;
  createdAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export const createRevisionRequestSchema = z.object({
  organizationId: z.string().min(1),
  description: z.string().min(3).max(5000),
  area: z.string().max(120).optional(),
});

export const resolveRevisionRequestSchema = z.object({
  organizationId: z.string().min(1),
  resolutionNote: z.string().min(3).max(5000),
});
