export type BudgetDecision={allowed:boolean;remainingUsd:number;reason:string};

export function evaluateAiBudget(limitUsd:number,spentUsd:number,reservedUsd:number,estimatedTaskUsd:number):BudgetDecision{
  const values=[limitUsd,spentUsd,reservedUsd,estimatedTaskUsd];
  if(values.some(value=>!Number.isFinite(value)||value<0))throw new Error("AI budget values must be finite non-negative numbers");
  const remainingUsd=Math.max(0,limitUsd-spentUsd-reservedUsd);
  return estimatedTaskUsd<=remainingUsd
    ?{allowed:true,remainingUsd,reason:"Task is within the configured AI budget"}
    :{allowed:false,remainingUsd,reason:`Task requires up to $${estimatedTaskUsd.toFixed(2)} but only $${remainingUsd.toFixed(2)} remains`};
}
