export type BudgetDecision={allowed:boolean;remainingUsd:number;reason:string};

export function evaluateAiBudget(limitUsd:number,spentUsd:number,reservedUsd:number,estimatedTaskUsd:number):BudgetDecision{
  const values=[limitUsd,spentUsd,reservedUsd,estimatedTaskUsd];
  if(values.some(value=>!Number.isFinite(value)||value<0))throw new Error("AI budget values must be finite non-negative numbers");
  const remainingUsd=Math.max(0,limitUsd-spentUsd-reservedUsd);
  return estimatedTaskUsd<=remainingUsd
    ?{allowed:true,remainingUsd,reason:"Task is within the configured AI budget"}
    :{allowed:false,remainingUsd,reason:`Task requires up to $${estimatedTaskUsd.toFixed(2)} but only $${remainingUsd.toFixed(2)} remains`};
}

export type ConcurrencyDecision={allowed:boolean;reason:string};

// An owner-configured per-agent ceiling (organizations/{orgId}/agentSettings/{agentId}.maxConcurrentTasks).
// Unset or non-positive means the owner has never explicitly configured a cap for this agent, so no
// concurrency ceiling is enforced — this matches the endpoint's own schema (min(1) once saved) and the
// governance UI, where the field simply does not exist until the owner submits the settings form.
export function evaluateAgentConcurrency(maxConcurrentTasks:number|undefined,inFlightCount:number):ConcurrencyDecision{
  if(!Number.isFinite(inFlightCount)||inFlightCount<0)throw new Error("In-flight task count must be a finite non-negative number");
  const limit=Number(maxConcurrentTasks??0);
  if(!Number.isFinite(limit)||limit<=0)return{allowed:true,reason:"No concurrency limit configured for this agent"};
  return inFlightCount<limit
    ?{allowed:true,reason:`${inFlightCount} of ${limit} concurrent task(s) in use`}
    :{allowed:false,reason:`Agent already has ${inFlightCount} task(s) running against a limit of ${limit}`};
}

// An owner-configured per-agent daily spend ceiling (agentSettings.dailyBudgetUsd), evaluated against
// the agent's own usage docs for "today" in the agency's timezone. Unset or non-positive means the
// owner has never explicitly capped this agent's spend, so no ceiling is enforced.
export function evaluateAgentDailyBudget(dailyBudgetUsd:number|undefined,spentTodayUsd:number):BudgetDecision{
  if(!Number.isFinite(spentTodayUsd)||spentTodayUsd<0)throw new Error("Daily agent spend must be a finite non-negative number");
  const limit=Number(dailyBudgetUsd??0);
  if(!Number.isFinite(limit)||limit<=0)return{allowed:true,remainingUsd:Number.POSITIVE_INFINITY,reason:"No daily budget configured for this agent"};
  const remainingUsd=Math.max(0,limit-spentTodayUsd);
  return spentTodayUsd<limit
    ?{allowed:true,remainingUsd,reason:`Within the agent's $${limit.toFixed(2)} daily budget`}
    :{allowed:false,remainingUsd,reason:`Agent has already spent $${spentTodayUsd.toFixed(2)} of its $${limit.toFixed(2)} daily budget today`};
}
