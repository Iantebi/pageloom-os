import { journeyStageSchema, type JourneyStage } from "./types.js";

export const customerJourney: readonly JourneyStage[] = journeyStageSchema.options;
export const automatedStages = new Set<JourneyStage>(["questionnaire","assets","planning","ui_design","development","quality_assurance","support","maintenance"]);
export const ceoCheckpointStages = new Set<JourneyStage>(["ceo_call","deal_closed","customer_approval","deployment"]);

export function nextJourneyStage(current: JourneyStage): JourneyStage | undefined {
  return customerJourney[customerJourney.indexOf(current) + 1];
}

export function assertJourneyTransition(current: JourneyStage, next: JourneyStage): void {
  if (nextJourneyStage(current) !== next) throw new Error(`Invalid customer journey transition: ${current} -> ${next}`);
}

export const stageOwner: Readonly<Record<JourneyStage, "ceo" | import("./types.js").AgentId>> = {
  lead: "sales", ceo_call: "ceo", deal_closed: "ceo", questionnaire: "client-journey", assets: "client-journey",
  planning: "project-manager", ui_design: "ui-ux-designer", development: "frontend-builder", quality_assurance: "qa",
  customer_approval: "ceo", deployment: "deployment", support: "support", maintenance: "maintenance",
};
