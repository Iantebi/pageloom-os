import { describe, expect, it } from "vitest";
import { measureCustomerJourney } from "./customer-experience.js";
import { resolveWorkflowTransition, type WorkflowEventType, type WorkflowStage } from "./workflow.js";

describe("golden customer experience", () => {
  it("completes the full no-error workflow with all launch timing spans", () => {
    const path: WorkflowEventType[] = ["PhoneCallScheduled", "LeadWon", "OnboardingStarted", "OnboardingCompleted", "QuestionnaireCompleted", "AssetsValidated", "ResearchCompleted", "BrandStrategyCompleted", "DesignSystemCompleted", "SitemapCompleted", "UXPlanCompleted", "UIGenerationCompleted", "CopywritingCompleted", "SEOOptimizationCompleted", "DevelopmentCompleted", "DeploymentPrepared", "QACompleted", "CEOApproved", "ProductionDeploymentCompleted", "CustomerApproved", "FinalDeploymentApproved", "FinalDeploymentCompleted", "ProjectCompleted"];
    let stage: WorkflowStage = "lead";
    for (const event of path) {
      const transition = resolveWorkflowTransition(stage, event);
      expect(transition, `${stage} -> ${event}`).toBeDefined();
      stage = transition!.to;
    }
    expect(stage).toBe("completed");

    const types: WorkflowEventType[] = ["LeadCreated", "PhoneCallCompleted", ...path.slice(1)];
    const measured = measureCustomerJourney(types.map((type, index) => ({ type, occurredAt: new Date(Date.UTC(2026, 7, 16, 8, index * 10)).toISOString() })));
    expect(measured.every(item => item.complete)).toBe(true);
    expect(measured.every(item => item.minutes! >= 0)).toBe(true);
  });

  it("reports incomplete spans without inventing a duration", () => {
    expect(measureCustomerJourney([{ type: "LeadCreated", occurredAt: "2026-08-16T08:00:00.000Z" }])[0]).toEqual({ key: "lead", complete: false });
  });
});
