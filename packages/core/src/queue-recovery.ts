export type RecoverableTask={status:string;attempt?:number;maxAttempts?:number;createdAt?:string;updatedAt?:string;startedAt?:string};
export type RecoveryDecision={action:"none"|"retry"|"dead_letter";nextAttempt:number;reason:string};
export function decideTaskRecovery(task:RecoverableTask,nowMs:number):RecoveryDecision{
  const attempt=Number(task.attempt??0),maxAttempts=Number(task.maxAttempts??3),timestamp=task.status==="running"?task.startedAt??task.updatedAt:task.createdAt??task.updatedAt,age=timestamp?nowMs-Date.parse(timestamp):0;
  const stale=task.status==="running"&&age>15*60_000||task.status==="queued"&&age>30*60_000;
  if(task.status!=="failed"&&!stale)return{action:"none",nextAttempt:attempt,reason:"Task is not recoverable"};
  if(attempt>=maxAttempts)return{action:"dead_letter",nextAttempt:attempt,reason:`Retry budget exhausted after ${attempt} attempts`};
  return{action:"retry",nextAttempt:attempt+1,reason:task.status==="failed"?"Retrying failed task":"Recovering stale task lease"};
}
