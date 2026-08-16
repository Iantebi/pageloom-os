import { z } from "zod";
import { financialEntrySchema } from "./finance.js";

export const createFinancialRecordSchema = financialEntrySchema.extend({
  organizationId: z.string().min(1),
  description: z.string().min(3).max(500),
  reference: z.string().max(200).optional(),
});

export const supportPrioritySchema = z.enum(["critical", "high", "normal", "low"]);
export const supportStatusSchema = z.enum(["open", "in_progress", "waiting_customer", "resolved", "closed"]);
export const createSupportTicketSchema = z.object({
  organizationId: z.string().min(1),
  customerId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  subject: z.string().min(3).max(200),
  description: z.string().min(10).max(10_000),
  priority: supportPrioritySchema.default("normal"),
});
export const updateSupportTicketSchema = z.object({
  organizationId: z.string().min(1),
  status: supportStatusSchema,
  resolution: z.string().min(3).max(10_000).optional(),
}).superRefine((value, context) => {
  if (["resolved", "closed"].includes(value.status) && !value.resolution) context.addIssue({ code: "custom", path: ["resolution"], message: "Resolution evidence is required" });
});

export function supportDueAt(priority: z.infer<typeof supportPrioritySchema>, openedAt: string) {
  const milliseconds = { critical: 60, high: 4 * 60, normal: 24 * 60, low: 72 * 60 }[priority] * 60_000;
  return new Date(Date.parse(openedAt) + milliseconds).toISOString();
}
