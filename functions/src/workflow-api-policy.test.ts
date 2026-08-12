import {describe,expect,it} from "vitest";
import {approvalDecisionEvent,workflowEventAuthority} from "./workflow-api-policy.js";

describe("workflow API policy",()=>{
  it("reserves deal closure and deployments for the owner",()=>{
    expect(workflowEventAuthority("LeadWon")).toBe("owner");
    expect(workflowEventAuthority("FinalDeploymentApproved")).toBe("owner");
  });
  it("allows customers to submit only their workflow actions",()=>{
    expect(workflowEventAuthority("QuestionnaireCompleted")).toBe("member");
    expect(workflowEventAuthority("CustomerRequestedRevision")).toBe("member");
  });
  it("does not allow callers to forge agent completion events",()=>{
    expect(workflowEventAuthority("DevelopmentCompleted")).toBe("system_only");
    expect(workflowEventAuthority("QACompleted")).toBe("system_only");
  });
  it("maps CEO checkpoints to explicit authorization events",()=>{
    expect(approvalDecisionEvent("ceo_approval","approved")).toBe("CEOApproved");
    expect(approvalDecisionEvent("final_deployment","approved")).toBe("FinalDeploymentApproved");
    expect(approvalDecisionEvent("final_deployment","rejected")).toBe("CEORejected");
  });
});
