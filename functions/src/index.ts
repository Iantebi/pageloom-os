import {onRequest} from "firebase-functions/v2/https";
import {onDocumentCreated,onDocumentUpdated} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {workflowStageSchema,type Task,type WorkflowEventType} from "@pageloom/core";
import {app} from "./api.js";import {params,runtimeSecrets} from "./config.js";import {db} from "./firebase.js";import {CentralOrchestrator} from "./orchestrator.js";
import {WorkflowEngine} from "./workflow-engine.js";
import {QueueRecovery} from "./queue-recovery.js";
import {exportFirestoreBackup} from "./backup.js";
import {runBackupFreshnessWatchdog} from "./watchdog.js";
import {resolveAiExecutionMode} from "./ai-execution-mode.js";
import {isProductionRuntime} from "./runtime-environment.js";
import {operationalLog} from "./observability.js";
import {runBusinessAutomationScan} from "./business-automation.js";

export const api=onRequest({region:params.region,secrets:runtimeSecrets,timeoutSeconds:120,memory:"1GiB",maxInstances:100,concurrency:40,invoker:"public"},app);
export const executeAgentTask=onDocumentCreated({document:"organizations/{organizationId}/tasks/{taskId}",region:params.region,secrets:runtimeSecrets,retry:true,timeoutSeconds:540,memory:"2GiB",maxInstances:50,concurrency:4},async event=>{
  if(!event.data)return;
  const orchestrator=new CentralOrchestrator();
  const decision=resolveAiExecutionMode({rawMode:params.aiExecutionMode.value(),rawApproval:params.aiExecutionModeApproval.value(),isProduction:isProductionRuntime()});
  if(decision.blocked)operationalLog("warning","ai_execution_mode.blocked",{reason:decision.reason,resolvedMode:decision.mode,organizationId:event.params.organizationId,taskId:event.params.taskId});
  else if(decision.mode==="api")operationalLog("info","ai_execution_mode.api_enabled",{reason:decision.reason,organizationId:event.params.organizationId,taskId:event.params.taskId});
  if(decision.mode==="manual")await orchestrator.prepareManual(event.params.organizationId,event.params.taskId);else await orchestrator.run(event.params.organizationId,event.params.taskId)
});
export const processWorkflowEvent=onDocumentCreated({document:"organizations/{organizationId}/workflowEvents/{eventId}",region:params.region,retry:true},async event=>{if(event.data)await new WorkflowEngine().process(event.params.organizationId,event.params.eventId)});
export const initializeProjectWorkflow=onDocumentCreated({document:"organizations/{organizationId}/projects/{projectId}",region:params.region,retry:true},async event=>{if(!event.data)return;const orgId=event.params.organizationId,projectId=event.params.projectId,instanceRef=db.doc(`organizations/${orgId}/workflowInstances/${projectId}`),projectRef=event.data.ref;
  const project=event.data.data(),now=new Date().toISOString(),closed=Boolean(project.dealClosedAt);
  // Guards against a real race, atomically: this onCreate trigger can be delayed (cold start) long
  // enough for some other manual, synchronous action on the same project (e.g.
  // onboarding-journey-api.ts's payment-confirmed endpoint, which drives the engine directly
  // rather than waiting on this trigger) to already have created workflowInstances and advanced
  // workflowStage well past "lead"/"phone_call" by the time this finally runs. Without this guard,
  // the unconditional writes below would silently reset that progress back to "phone_call" and
  // re-emit LeadWon, clobbering everything that happened since. A workflowInstances doc is only
  // ever meant to be created once, right here - if it already exists, initialization already ran.
  const alreadyInitialized=await db.runTransaction(async tx=>{
    if((await tx.get(instanceRef)).exists)return true;
    tx.set(instanceRef,{id:projectId,projectId,currentStage:closed?"phone_call":"lead",nextStage:closed?"closed_won":"phone_call",status:"active",blockedReason:null,responsibleAgents:["sales"],responsibleStage:closed?"phone_call":"lead",approvalRule:"none",attempt:1,facts:{leadExists:true,...(closed?{callCompleted:true}:{})},enteredAt:now,estimatedCompletionAt:now,timeoutAt:new Date(Date.now()+1440*60_000).toISOString(),createdAt:now,updatedAt:now});
    tx.update(projectRef,{workflowStage:closed?"phone_call":"lead",nextWorkflowStage:closed?"closed_won":"phone_call",workflowStatus:"active",responsibleAgents:["sales"],updatedAt:now});
    return false;
  });
  if(alreadyInitialized)return;
  await new WorkflowEngine().emit({organizationId:orgId,projectId,type:closed?"LeadWon":"LeadCreated",source:"system",sourceId:"project-created",payload:{dealClosed:closed},occurredAt:now,idempotencyKey:`project-created-${projectId}`})});
export const handleWorkflowTaskResult=onDocumentUpdated({document:"organizations/{organizationId}/tasks/{taskId}",region:params.region,retry:true},async event=>{const before=event.data?.before.data(),after=event.data?.after.data()as Task|undefined;if(!after||before?.status===after.status||!after.projectId||after.createdBy!=="workflow-engine")return;const stage=workflowStageSchema.safeParse(after.context.workflowStage);if(!stage.success)return;const engine=new WorkflowEngine(),now=new Date().toISOString();if(after.status==="failed"){await engine.emit({organizationId:event.params.organizationId,projectId:after.projectId,type:"AgentTaskFailed",source:"orchestrator",sourceId:after.id,payload:{stage:stage.data,error:after.error??"Agent task failed"},occurredAt:now,idempotencyKey:`failed-${after.id}-${after.attempt}`});return}if(after.status!=="completed")return;const tasks=await db.collection(`organizations/${event.params.organizationId}/tasks`).where("projectId","==",after.projectId).get(),attempt=after.context.workflowAttempt,stageTasks=tasks.docs.map(doc=>doc.data()as Task).filter(task=>task.createdBy==="workflow-engine"&&task.context.workflowStage===stage.data&&task.context.workflowAttempt===attempt);if(stageTasks.some(task=>task.status!=="completed"))return;const completion:Partial<Record<typeof stage.data,WorkflowEventType>>={closed_won:"OnboardingStarted",onboarding:"OnboardingCompleted",research:"ResearchCompleted",brand_strategy:"BrandStrategyCompleted",design_system:"DesignSystemCompleted",sitemap:"SitemapCompleted",ux_planning:"UXPlanCompleted",ui_generation:"UIGenerationCompleted",copywriting:"CopywritingCompleted",seo_optimization:"SEOOptimizationCompleted",development:"DevelopmentCompleted",deployment_preparation:"DeploymentPrepared",qa:"QACompleted",production_deployment:"ProductionDeploymentCompleted",revision:"RevisionCompleted",final_deployment:"FinalDeploymentCompleted",completed:"ProjectCompleted"};const qaFailed=stage.data==="qa"&&stageTasks.some(task=>task.output?.workflowOutcome.status==="failed"),type:WorkflowEventType|undefined=qaFailed?"QAFailed":completion[stage.data];if(type)await engine.emit({organizationId:event.params.organizationId,projectId:after.projectId,type,source:"orchestrator",sourceId:after.id,payload:{stage:stage.data,taskIds:stageTasks.map(task=>task.id),evidence:stageTasks.flatMap(task=>task.output?.workflowOutcome.evidence??[])},occurredAt:now,idempotencyKey:`complete-${after.projectId}-${stage.data}-${attempt}-${type}`})});
export const monitorWorkflowTimeouts=onSchedule({schedule:"every 10 minutes",region:params.region,retryCount:3,memory:"512MiB"},async()=>new WorkflowEngine().scanTimeouts());
export const recoverAgentQueue=onSchedule({schedule:"every 5 minutes",region:params.region,retryCount:3},async()=>new QueueRecovery().scan());
export const dailyFirestoreBackup=onSchedule({schedule:"30 2 * * *",timeZone:params.agencyTimezone,region:params.region,retryCount:3,timeoutSeconds:540,serviceAccount:params.backupServiceAccount},exportFirestoreBackup);
export const monitorBusinessRisks=onSchedule({schedule:"every 1 hours",region:params.region,retryCount:3,memory:"512MiB"},runBusinessAutomationScan);
export const backupFreshnessWatchdog=onSchedule({schedule:"every 6 hours",region:params.region,retryCount:3},runBackupFreshnessWatchdog);
export const dailyCeoReport=onSchedule({schedule:"0 8 * * *",timeZone:params.agencyTimezone,region:params.region,retryCount:3,memory:"512MiB"},async()=>{const orgs=await db.collection("organizations").where("autonomyEnabled","==",true).get();for(const org of orgs.docs){const key=new Date().toLocaleDateString("en-CA",{timeZone:params.agencyTimezone.value()});const ref=db.doc(`organizations/${org.id}/scheduledJobs/ceo-daily-${key}`);try{await ref.create({createdAt:new Date().toISOString()})}catch{continue}const task=db.collection(`organizations/${org.id}/tasks`).doc();await task.set({id:task.id,organizationId:org.id,agentId:"ceo",objective:"Produce today's executive report from verified operating data. Analyze priorities, projects, pipeline, analytics, revenue, cost, API usage, and agent performance; delegate urgent internal outcomes.",locale:org.data().defaultLocale??"en",priority:"high",status:"queued",context:{schedule:"daily-ceo",date:key,internalOnly:true},constraints:["Use only verified data","Never contact customers","Protected actions require CEO approval"],createdBy:"scheduler",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),attempt:0})}});
