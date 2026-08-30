export type AiExecutionMode="manual"|"api";

// A deliberate, hard-to-typo confirmation phrase. Setting AI_EXECUTION_MODE=api alone is not
// enough to enable real, billable AI calls in production: AI_EXECUTION_MODE_APPROVAL must also be
// set to exactly this value. Two independent config values have to agree before production can
// leave the free "manual" queue, so a single stray/typo'd env var can never flip live billing on.
export const REQUIRED_PRODUCTION_API_APPROVAL="API_MODE_APPROVED_FOR_PRODUCTION";

export interface AiExecutionModeInput{rawMode:string|undefined;rawApproval:string|undefined;isProduction:boolean}
export interface AiExecutionModeDecision{mode:AiExecutionMode;blocked:boolean;reason:string}

const normalize=(value:string|undefined):string=>(value??"").trim();

// Fails safe: any missing, invalid, ambiguous, or unrecognized configuration resolves to the
// non-billable "manual" mode rather than silently falling back to a live provider.
export function resolveAiExecutionMode(input:AiExecutionModeInput):AiExecutionModeDecision{
  const mode=normalize(input.rawMode).toLowerCase();
  if(mode===""||mode==="manual")return{mode:"manual",blocked:false,reason:"manual queue mode"};
  if(mode!=="api")return{mode:"manual",blocked:true,reason:"unrecognized AI_EXECUTION_MODE value; failing safe to manual"};
  if(!input.isProduction)return{mode:"api",blocked:false,reason:"api mode enabled outside production (emulator/local development)"};
  const approval=normalize(input.rawApproval);
  if(approval!==REQUIRED_PRODUCTION_API_APPROVAL)return{mode:"manual",blocked:true,reason:"production api mode requires AI_EXECUTION_MODE_APPROVAL to match the required confirmation value; failing safe to manual"};
  return{mode:"api",blocked:false,reason:"production api mode explicitly approved"};
}

// Back-compat helper for callers that only need the resolved mode without the block/reason detail.
export function aiExecutionMode(rawMode:string|undefined,rawApproval:string|undefined,isProduction:boolean):AiExecutionMode{return resolveAiExecutionMode({rawMode,rawApproval,isProduction}).mode}

export interface AiExecutionRequest{systemPrompt:string;prompt:string;requiredDeliverables:readonly string[]}
export interface AiExecutionAdapter{readonly mode:AiExecutionMode;prepare(request:AiExecutionRequest):Promise<Record<string,unknown>>}
export class ManualAiQueueAdapter implements AiExecutionAdapter{readonly mode="manual" as const;async prepare(request:AiExecutionRequest){return{status:"ready",systemPrompt:request.systemPrompt,prompt:request.prompt,requiredDeliverables:[...request.requiredDeliverables],preparedAt:new Date().toISOString()}}}
