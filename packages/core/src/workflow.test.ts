import {describe,expect,it} from "vitest";
import {canStartAgentWork,eventAuthorizesProtectedStage,eventTransitions,resolveWorkflowTransition,stageCreatesAgentTasks,workflowDefinitions,workflowDeliverables,workflowOrder} from "./workflow.js";

describe("website production workflow",()=>{
  it("defines a complete policy for every ordered stage",()=>{
    expect(Object.keys(workflowDefinitions)).toEqual(workflowOrder);
    for(const current of workflowOrder){
      const policy=workflowDefinitions[current];
      expect(policy.timeoutMinutes).toBeGreaterThan(0);
      expect(policy.retry.maxAttempts).toBeGreaterThan(0);
      expect(policy.notifications.length).toBeGreaterThan(0);
    }
  });
  it("blocks AI work until the owner closes the deal",()=>{
    expect(canStartAgentWork("phone_call",false)).toBe(false);
    expect(canStartAgentWork("phone_call",true)).toBe(false);
    expect(canStartAgentWork("closed_won",true)).toBe(true);
    expect(resolveWorkflowTransition("phone_call","LeadWon")).toEqual({from:"phone_call",to:"closed_won"});
  });
  it("models every requested production phase independently",()=>{
    expect(workflowOrder).toEqual(expect.arrayContaining(["research","design_system","sitemap","ux_planning","ui_generation","deployment_preparation","customer_review","revision","final_deployment","completed"]));
  });
  it("requires a verifiable artifact from every automatic production stage",()=>{
    for(const current of workflowOrder.filter(stage=>stageCreatesAgentTasks(stage)))expect(workflowDeliverables[current]?.length,current).toBeGreaterThan(0);
  });
  it("allows agents to start only on automatic stages",()=>{
    expect(stageCreatesAgentTasks("research")).toBe(true);
    expect(stageCreatesAgentTasks("questionnaire")).toBe(false);
    expect(stageCreatesAgentTasks("ceo_approval")).toBe(false);
    expect(stageCreatesAgentTasks("customer_review")).toBe(false);
  });
  it("rolls QA failure back to development",()=>expect(eventTransitions.QAFailed).toEqual({from:["qa"],to:"development"}));
  it("rolls missing assets back from downstream production",()=>{
    expect(eventTransitions.AssetsMissing?.to).toBe("assets");
    expect(eventTransitions.AssetsMissing?.from).toContain("qa");
  });
  it("requires CEO approval for both production deployments",()=>{
    expect(workflowDefinitions.production_deployment.approval).toBe("ceo");
    expect(workflowDefinitions.final_deployment.approval).toBe("ceo");
    expect(eventAuthorizesProtectedStage("production_deployment","CEOApproved")).toBe(true);
    expect(stageCreatesAgentTasks("production_deployment")).toBe(true);
    expect(stageCreatesAgentTasks("final_deployment")).toBe(false);
    expect(eventAuthorizesProtectedStage("final_deployment","FinalDeploymentApproved")).toBe(true);
  });
  it("routes customer revisions through QA and CEO approval again",()=>{
    expect(resolveWorkflowTransition("customer_review","CustomerRequestedRevision")?.to).toBe("revision");
    expect(resolveWorkflowTransition("revision","RevisionCompleted")?.to).toBe("ceo_approval");
  });
});
