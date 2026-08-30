import{describe,expect,it}from"vitest";
import{resolveAiExecutionMode,aiExecutionMode,ManualAiQueueAdapter,REQUIRED_PRODUCTION_API_APPROVAL}from"./ai-execution-mode.js";

describe("AI execution mode guardrail",()=>{
  it("defaults safely to manual when unset, in production and outside it",()=>{
    expect(resolveAiExecutionMode({rawMode:undefined,rawApproval:undefined,isProduction:true})).toMatchObject({mode:"manual",blocked:false});
    expect(resolveAiExecutionMode({rawMode:undefined,rawApproval:undefined,isProduction:false})).toMatchObject({mode:"manual",blocked:false});
  });

  it("stays manual when explicitly set to manual, regardless of environment or approval", ()=>{
    expect(resolveAiExecutionMode({rawMode:" Manual ",rawApproval:undefined,isProduction:true})).toMatchObject({mode:"manual",blocked:false});
  });

  it("blocks production api mode with no approval configured", ()=>{
    const decision=resolveAiExecutionMode({rawMode:"api",rawApproval:undefined,isProduction:true});
    expect(decision).toMatchObject({mode:"manual",blocked:true});
  });

  it("blocks production api mode when the approval value does not match exactly", ()=>{
    const decision=resolveAiExecutionMode({rawMode:"api",rawApproval:"yes",isProduction:true});
    expect(decision).toMatchObject({mode:"manual",blocked:true});
  });

  it("does not enable api mode from approval alone when the mode itself is missing", ()=>{
    const decision=resolveAiExecutionMode({rawMode:undefined,rawApproval:REQUIRED_PRODUCTION_API_APPROVAL,isProduction:true});
    expect(decision).toMatchObject({mode:"manual",blocked:false});
  });

  it("allows production api mode only with the exact explicit approval value", ()=>{
    const decision=resolveAiExecutionMode({rawMode:" API ",rawApproval:REQUIRED_PRODUCTION_API_APPROVAL,isProduction:true});
    expect(decision).toMatchObject({mode:"api",blocked:false});
  });

  it("allows api mode outside production without requiring the production approval token", ()=>{
    const decision=resolveAiExecutionMode({rawMode:"api",rawApproval:undefined,isProduction:false});
    expect(decision).toMatchObject({mode:"api",blocked:false});
  });

  it("blocks an unknown/typo'd execution mode value in production", ()=>{
    const decision=resolveAiExecutionMode({rawMode:"apiary",rawApproval:REQUIRED_PRODUCTION_API_APPROVAL,isProduction:true});
    expect(decision).toMatchObject({mode:"manual",blocked:true});
  });

  it("blocks an unknown/typo'd execution mode value outside production too", ()=>{
    const decision=resolveAiExecutionMode({rawMode:"apiary",rawApproval:undefined,isProduction:false});
    expect(decision).toMatchObject({mode:"manual",blocked:true});
  });

  it("exposes a mode-only helper for simple callers", ()=>{
    expect(aiExecutionMode("api",REQUIRED_PRODUCTION_API_APPROVAL,true)).toBe("api");
    expect(aiExecutionMode("api",undefined,true)).toBe("manual");
  });

  it("prepares a provider-independent queue item",async()=>expect(await new ManualAiQueueAdapter().prepare({systemPrompt:"policy",prompt:"work",requiredDeliverables:["website_source"]})).toMatchObject({status:"ready",systemPrompt:"policy",prompt:"work",requiredDeliverables:["website_source"]}));
});
