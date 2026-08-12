import{describe,expect,it}from"vitest";import{evaluateAiBudget}from"./budget.js";
describe("AI budget policy",()=>{
  it("accounts for completed spend and concurrent reservations",()=>expect(evaluateAiBudget(100,72,20,8)).toMatchObject({allowed:true,remainingUsd:8}));
  it("blocks work before it can exceed the ceiling",()=>expect(evaluateAiBudget(100,72,20,9)).toMatchObject({allowed:false,remainingUsd:8}));
  it("rejects invalid financial inputs",()=>expect(()=>evaluateAiBudget(100,-1,0,4)).toThrow(/non-negative/));
});
