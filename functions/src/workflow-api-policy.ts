import type {WorkflowEventType,WorkflowStage} from "@pageloom/core";

export type WorkflowEventAuthority="owner"|"member"|"system_only";

const ownerEvents=new Set<WorkflowEventType>([
  "PhoneCallScheduled","PhoneCallCompleted","LeadWon","PaymentConfirmed","AssetsValidated","CEOApproved",
  "CEORejected","FinalDeploymentApproved","ManualRetryRequested"
]);
const memberEvents=new Set<WorkflowEventType>([
  "QuestionnaireCompleted","AssetsUploaded","CustomerApproved","CustomerRequestedRevision","AssetsMissing"
]);

export function workflowEventAuthority(type:WorkflowEventType):WorkflowEventAuthority {
  if(ownerEvents.has(type))return "owner";
  if(memberEvents.has(type))return "member";
  return "system_only";
}

export function approvalDecisionEvent(stage:WorkflowStage,decision:"approved"|"rejected"):WorkflowEventType {
  if(decision==="rejected")return "CEORejected";
  if(stage==="ceo_approval")return "CEOApproved";
  if(stage==="final_deployment")return "FinalDeploymentApproved";
  throw new Error(`Workflow stage ${stage} is not a CEO approval checkpoint`);
}
