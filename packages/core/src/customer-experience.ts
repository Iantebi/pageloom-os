import { z } from "zod";
import { workflowEventTypeSchema, type WorkflowEventType } from "./workflow.js";

export const journeyEventSchema = z.object({ type: workflowEventTypeSchema, occurredAt: z.string().datetime() });
export type JourneyEvent = z.infer<typeof journeyEventSchema>;
export type JourneyTiming = { key: "lead" | "proposal" | "questionnaire" | "website" | "review" | "deployment" | "delivery"; minutes?: number; complete: boolean };

const spans: Array<{ key: JourneyTiming["key"]; from: WorkflowEventType; to: WorkflowEventType }> = [
  { key: "lead", from: "LeadCreated", to: "LeadWon" },
  { key: "proposal", from: "PhoneCallCompleted", to: "LeadWon" },
  { key: "questionnaire", from: "OnboardingCompleted", to: "QuestionnaireCompleted" },
  { key: "website", from: "AssetsValidated", to: "QACompleted" },
  { key: "review", from: "ProductionDeploymentCompleted", to: "CustomerApproved" },
  { key: "deployment", from: "CEOApproved", to: "FinalDeploymentCompleted" },
  { key: "delivery", from: "FinalDeploymentCompleted", to: "ProjectCompleted" },
];

export function measureCustomerJourney(input: unknown[]): JourneyTiming[] {
  const events = input.map(event => journeyEventSchema.parse(event)).sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  return spans.map(span => {
    const start = events.find(event => event.type === span.from);
    const end = [...events].reverse().find(event => event.type === span.to && (!start || Date.parse(event.occurredAt) >= Date.parse(start.occurredAt)));
    return { key: span.key, complete: Boolean(start && end), ...(start && end ? { minutes: Math.round((Date.parse(end.occurredAt) - Date.parse(start.occurredAt)) / 60_000) } : {}) };
  });
}
