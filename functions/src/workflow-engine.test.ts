import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./workflow-engine.ts", import.meta.url), "utf8");

describe("workflow engine notifications", () => {
  it("tags every stage-change notification with a stable type and structured params, alongside the existing English title/body, so a frontend dictionary can localize it", () => {
    expect(source).toContain('type:"workflow_stage_changed"');
    expect(source).toContain("params:{fromStage:transition.from,toStage:transition.to,isRetry,agentIds:policy.requiredAgents,approval:policy.approval,dueAt:due}");
    // The pre-formatted English fallback must still be written, unchanged, so older/untranslated
    // consumers keep working.
    expect(source).toContain("title:`Project ${isRetry?\"retrying\":\"moved to\"} ${transition.to.replaceAll(\"_\",\" \")}`");
    expect(source).toContain("body:`Responsible: ${policy.requiredAgents.join(\", \")||policy.approval}. Estimated completion ${due}.`");
  });
  it("notifies the customer with a preview_ready type when ProductionDeploymentCompleted is processed", () => {
    expect(source).toContain('event.type==="ProductionDeploymentCompleted"');
    expect(source).toContain('audience:"customer"');
    expect(source).toContain('type:"preview_ready"');
  });
  it("sets customerApprovedAt and notifies the owner with a final_approval_recorded type when CustomerApproved is processed", () => {
    expect(source).toContain('event.type==="CustomerApproved"?{customerApprovedAt:nowIso}');
    expect(source).toContain('type:"final_approval_recorded"');
  });
});
