export type AiExecutionMode="manual"|"api";
export function aiExecutionMode(value:string|undefined):AiExecutionMode{return value?.trim().toLowerCase()==="api"?"api":"manual"}
export interface AiExecutionRequest{systemPrompt:string;prompt:string;requiredDeliverables:readonly string[]}
export interface AiExecutionAdapter{readonly mode:AiExecutionMode;prepare(request:AiExecutionRequest):Promise<Record<string,unknown>>}
export class ManualAiQueueAdapter implements AiExecutionAdapter{readonly mode="manual" as const;async prepare(request:AiExecutionRequest){return{status:"ready",systemPrompt:request.systemPrompt,prompt:request.prompt,requiredDeliverables:[...request.requiredDeliverables],preparedAt:new Date().toISOString()}}}
