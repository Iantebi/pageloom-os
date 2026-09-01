import { z } from "zod";

// Post-launch handover record — the durable answer to "what did the customer get told at
// launch". Recorded once, read by both the customer (their own project) and staff.
export interface Handover {
  id: "current";
  liveUrl: string;
  supportInstructions: string;
  maintenanceInfo: string;
  pageloomResponsibilities: string;
  customerResponsibilities: string;
  createdBy: string;
  createdAt: string;
}

export const recordHandoverSchema = z.object({
  organizationId: z.string().min(1),
  liveUrl: z.string().url(),
  supportInstructions: z.string().min(3).max(5000),
  maintenanceInfo: z.string().min(3).max(5000),
  pageloomResponsibilities: z.string().min(3).max(5000),
  customerResponsibilities: z.string().min(3).max(5000),
});
