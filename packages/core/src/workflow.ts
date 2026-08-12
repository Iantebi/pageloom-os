import {z} from "zod";
import type {AgentId} from "./types.js";

export const workflowStageSchema=z.enum([
  "lead","phone_call","closed_won","onboarding","questionnaire","assets","research",
  "brand_strategy","design_system","sitemap","ux_planning","ui_generation","copywriting",
  "seo_optimization","development","deployment_preparation","qa","ceo_approval",
  "production_deployment","customer_review","revision","final_deployment","completed"
]);
export type WorkflowStage=z.infer<typeof workflowStageSchema>;

export const workflowEventTypeSchema=z.enum([
  "LeadCreated","PhoneCallScheduled","PhoneCallCompleted","LeadWon","OnboardingStarted","OnboardingCompleted",
  "QuestionnaireCompleted","AssetsUploaded","AssetsValidated","ResearchCompleted",
  "BrandStrategyCompleted","DesignSystemCompleted","SitemapCompleted","UXPlanCompleted",
  "UIGenerationCompleted","CopywritingCompleted","SEOOptimizationCompleted",
  "DevelopmentCompleted","DeploymentPrepared","QACompleted","QAFailed","CEOApproved",
  "CEORejected","ProductionDeploymentCompleted","CustomerApproved","CustomerRequestedRevision",
  "RevisionCompleted","FinalDeploymentApproved","FinalDeploymentCompleted","ProjectCompleted","AssetsMissing",
  "StageTimedOut","AgentTaskFailed","ManualRetryRequested"
]);
export type WorkflowEventType=z.infer<typeof workflowEventTypeSchema>;

export const workflowConditionSchema=z.enum([
  "leadExists","callCompleted","dealWon","onboardingComplete","questionnaireComplete",
  "assetsComplete","researchComplete","brandStrategyComplete","designSystemComplete",
  "sitemapComplete","uxPlanComplete","uiComplete","copyComplete","seoComplete",
  "developmentComplete","deploymentPrepared","qaPassed","ceoApproved","productionDeployed",
  "customerApproved","revisionComplete","finalDeploymentComplete"
]);
export type WorkflowCondition=z.infer<typeof workflowConditionSchema>;
export type WorkflowApproval="none"|"ceo"|"customer";
export type WorkflowStartMode="automatic"|"manual"|"approval"|"customer_action";

export interface WorkflowStageDefinition {
  stage:WorkflowStage;
  entryConditions:WorkflowCondition[];
  exitEvents:WorkflowEventType[];
  requiredAgents:AgentId[];
  approval:WorkflowApproval;
  startMode:WorkflowStartMode;
  timeoutMinutes:number;
  retry:{maxAttempts:number;backoffMinutes:number};
  notifications:("ceo"|"project_manager"|"customer")[];
  estimatedMinutes:number;
  rollbackStage?:WorkflowStage;
}

export const workflowOrder=workflowStageSchema.options;

const stage=(
  name:WorkflowStage,entryConditions:WorkflowCondition[],exitEvents:WorkflowEventType[],
  requiredAgents:AgentId[],approval:WorkflowApproval,startMode:WorkflowStartMode,
  estimatedMinutes:number,timeoutMinutes=2880,maxAttempts=3,backoffMinutes=60,
  notifications:WorkflowStageDefinition["notifications"]=["project_manager"]
):WorkflowStageDefinition=>({stage:name,entryConditions,exitEvents,requiredAgents,approval,startMode,
  estimatedMinutes,timeoutMinutes,retry:{maxAttempts,backoffMinutes},notifications});

export const workflowDefinitions:Record<WorkflowStage,WorkflowStageDefinition>={
  lead:stage("lead",[],["PhoneCallScheduled"],["sales"],"none","manual",60,1440,3,30,["ceo"]),
  phone_call:stage("phone_call",["leadExists"],["PhoneCallCompleted","LeadWon"],["sales"],"none","manual",60,2880,2,120,["ceo"]),
  closed_won:stage("closed_won",["callCompleted","dealWon"],["OnboardingStarted"],["project-manager"],"none","automatic",30,1440,3,60,["ceo","project_manager"]),
  onboarding:stage("onboarding",["dealWon"],["OnboardingCompleted"],["client-journey","project-manager"],"none","automatic",120,2880),
  questionnaire:stage("questionnaire",["onboardingComplete"],["QuestionnaireCompleted"],["client-journey"],"none","customer_action",240,4320,3,240,["project_manager","customer"]),
  assets:{...stage("assets",["questionnaireComplete"],["AssetsUploaded","AssetsValidated"],["media","project-manager"],"none","customer_action",480,4320,3,240,["project_manager","customer"]),rollbackStage:"assets"},
  research:stage("research",["assetsComplete"],["ResearchCompleted"],["website-architect","seo"],"none","automatic",360),
  brand_strategy:stage("brand_strategy",["researchComplete"],["BrandStrategyCompleted"],["brand"],"none","automatic",480),
  design_system:stage("design_system",["brandStrategyComplete"],["DesignSystemCompleted"],["ui-ux-designer"],"none","automatic",480),
  sitemap:stage("sitemap",["designSystemComplete"],["SitemapCompleted"],["website-architect","seo"],"none","automatic",360),
  ux_planning:stage("ux_planning",["sitemapComplete"],["UXPlanCompleted"],["ui-ux-designer","website-architect"],"none","automatic",480),
  ui_generation:stage("ui_generation",["uxPlanComplete"],["UIGenerationCompleted"],["ui-ux-designer"],"none","automatic",720),
  copywriting:stage("copywriting",["uiComplete"],["CopywritingCompleted"],["content"],"none","automatic",600),
  seo_optimization:stage("seo_optimization",["copyComplete"],["SEOOptimizationCompleted"],["seo"],"none","automatic",360),
  development:{...stage("development",["seoComplete"],["DevelopmentCompleted"],["frontend-builder","backend","firebase"],"none","automatic",1440,5760,3,180),rollbackStage:"development"},
  deployment_preparation:stage("deployment_preparation",["developmentComplete"],["DeploymentPrepared"],["firebase","deployment"],"none","automatic",240,1440),
  qa:stage("qa",["deploymentPrepared"],["QACompleted","QAFailed"],["qa"],"none","automatic",480,1440),
  ceo_approval:stage("ceo_approval",["qaPassed"],["CEOApproved","CEORejected"],[],"ceo","approval",1440,10080,1,0,["ceo"]),
  production_deployment:stage("production_deployment",["ceoApproved"],["ProductionDeploymentCompleted"],["deployment","firebase"],"ceo","automatic",180,720,3,30,["ceo","project_manager"]),
  customer_review:stage("customer_review",["productionDeployed"],["CustomerApproved","CustomerRequestedRevision"],[],"customer","customer_action",1440,10080,5,240,["ceo","project_manager","customer"]),
  revision:{...stage("revision",["productionDeployed"],["RevisionCompleted"],["project-manager","ui-ux-designer","content","frontend-builder","qa"],"none","automatic",720,4320,5,120),rollbackStage:"revision"},
  final_deployment:stage("final_deployment",["customerApproved"],["FinalDeploymentApproved","FinalDeploymentCompleted"],["deployment","firebase"],"ceo","approval",180,720,3,30,["ceo","project_manager"]),
  completed:stage("completed",["finalDeploymentComplete"],["ProjectCompleted"],["project-manager","maintenance","analytics","support"],"none","automatic",30,1440,3,60,["ceo","project_manager","customer"])
};

export const eventTransitions:Partial<Record<WorkflowEventType,{from:WorkflowStage[];to:WorkflowStage}>>={
  PhoneCallScheduled:{from:["lead"],to:"phone_call"},
  PhoneCallCompleted:{from:["phone_call"],to:"phone_call"},
  LeadWon:{from:["phone_call"],to:"closed_won"},
  OnboardingStarted:{from:["closed_won"],to:"onboarding"},
  OnboardingCompleted:{from:["onboarding"],to:"questionnaire"},
  QuestionnaireCompleted:{from:["questionnaire"],to:"assets"},
  AssetsUploaded:{from:["assets"],to:"assets"},
  AssetsValidated:{from:["assets"],to:"research"},
  ResearchCompleted:{from:["research"],to:"brand_strategy"},
  BrandStrategyCompleted:{from:["brand_strategy"],to:"design_system"},
  DesignSystemCompleted:{from:["design_system"],to:"sitemap"},
  SitemapCompleted:{from:["sitemap"],to:"ux_planning"},
  UXPlanCompleted:{from:["ux_planning"],to:"ui_generation"},
  UIGenerationCompleted:{from:["ui_generation"],to:"copywriting"},
  CopywritingCompleted:{from:["copywriting"],to:"seo_optimization"},
  SEOOptimizationCompleted:{from:["seo_optimization"],to:"development"},
  DevelopmentCompleted:{from:["development"],to:"deployment_preparation"},
  DeploymentPrepared:{from:["deployment_preparation"],to:"qa"},
  QACompleted:{from:["qa"],to:"ceo_approval"},
  QAFailed:{from:["qa"],to:"development"},
  CEOApproved:{from:["ceo_approval"],to:"production_deployment"},
  CEORejected:{from:["ceo_approval"],to:"revision"},
  ProductionDeploymentCompleted:{from:["production_deployment"],to:"customer_review"},
  CustomerApproved:{from:["customer_review"],to:"final_deployment"},
  CustomerRequestedRevision:{from:["customer_review"],to:"revision"},
  RevisionCompleted:{from:["revision"],to:"ceo_approval"},
  FinalDeploymentApproved:{from:["final_deployment"],to:"final_deployment"},
  FinalDeploymentCompleted:{from:["final_deployment"],to:"completed"},
  ProjectCompleted:{from:["completed"],to:"completed"},
  AssetsMissing:{from:["research","brand_strategy","design_system","sitemap","ux_planning","ui_generation","copywriting","seo_optimization","development","deployment_preparation","qa","ceo_approval","revision"],to:"assets"}
};

export function nextWorkflowStage(current:WorkflowStage){return workflowOrder[workflowOrder.indexOf(current)+1]}
export function workflowProgress(current:WorkflowStage){return Math.round(workflowOrder.indexOf(current)/(workflowOrder.length-1)*100)}
export function resolveWorkflowTransition(current:WorkflowStage,event:WorkflowEventType){
  if(event==="LeadCreated")return current==="lead"?{from:current,to:current}:undefined;
  const transition=eventTransitions[event];
  return transition?.from.includes(current)?{from:current,to:transition.to}:undefined;
}
export function canStartAgentWork(current:WorkflowStage,dealClosed:boolean){
  return dealClosed&&workflowOrder.indexOf(current)>=workflowOrder.indexOf("closed_won");
}
export function stageCreatesAgentTasks(current:WorkflowStage){
  const definition=workflowDefinitions[current];
  return definition.startMode==="automatic"&&definition.requiredAgents.length>0;
}
export function eventAuthorizesProtectedStage(current:WorkflowStage,event:WorkflowEventType){
  return current==="production_deployment"&&event==="CEOApproved"||current==="final_deployment"&&event==="FinalDeploymentApproved";
}
