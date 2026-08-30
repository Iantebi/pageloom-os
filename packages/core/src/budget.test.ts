import{describe,expect,it}from"vitest";import{evaluateAgentConcurrency,evaluateAgentDailyBudget,evaluateAiBudget}from"./budget.js";
describe("AI budget policy",()=>{
  it("accounts for completed spend and concurrent reservations",()=>expect(evaluateAiBudget(100,72,20,8)).toMatchObject({allowed:true,remainingUsd:8}));
  it("blocks work before it can exceed the ceiling",()=>expect(evaluateAiBudget(100,72,20,9)).toMatchObject({allowed:false,remainingUsd:8}));
  it("rejects invalid financial inputs",()=>expect(()=>evaluateAiBudget(100,-1,0,4)).toThrow(/non-negative/));
});
describe("per-agent concurrency governance",()=>{
  it("allows dispatch while under the configured ceiling",()=>expect(evaluateAgentConcurrency(3,2)).toMatchObject({allowed:true}));
  it("blocks dispatch once the agent is at its ceiling",()=>expect(evaluateAgentConcurrency(3,3)).toMatchObject({allowed:false}));
  it("blocks dispatch when the agent is already over its ceiling",()=>expect(evaluateAgentConcurrency(3,5)).toMatchObject({allowed:false}));
  it("treats an unset limit as no cap",()=>expect(evaluateAgentConcurrency(undefined,50)).toMatchObject({allowed:true}));
  it("treats a zero limit as no cap, matching the unset case",()=>expect(evaluateAgentConcurrency(0,50)).toMatchObject({allowed:true}));
  it("rejects a negative in-flight count",()=>expect(()=>evaluateAgentConcurrency(3,-1)).toThrow(/non-negative/));
});
describe("per-agent daily budget governance",()=>{
  it("allows dispatch while under today's ceiling",()=>expect(evaluateAgentDailyBudget(20,12)).toMatchObject({allowed:true,remainingUsd:8}));
  it("blocks dispatch once today's spend reaches the ceiling",()=>expect(evaluateAgentDailyBudget(20,20)).toMatchObject({allowed:false,remainingUsd:0}));
  it("blocks dispatch once today's spend exceeds the ceiling",()=>expect(evaluateAgentDailyBudget(20,25)).toMatchObject({allowed:false,remainingUsd:0}));
  it("treats an unset budget as no cap",()=>expect(evaluateAgentDailyBudget(undefined,999)).toMatchObject({allowed:true}));
  it("treats a zero budget as no cap, matching the unset case",()=>expect(evaluateAgentDailyBudget(0,999)).toMatchObject({allowed:true}));
  it("rejects negative spend",()=>expect(()=>evaluateAgentDailyBudget(20,-1)).toThrow(/non-negative/));
});
