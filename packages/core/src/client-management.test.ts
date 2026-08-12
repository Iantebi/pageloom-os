import{describe,expect,it}from"vitest";import{createCustomerSchema,questionnaireAgentPlan,questionnaireFieldSchema,validateRequiredQuestionnaireFields}from"./client-management.js";
describe("client management contracts",()=>{
it("requires a customer contact",()=>{expect(createCustomerSchema.safeParse({organizationId:"org",businessName:"Acme",industry:"SaaS",contacts:[]}).success).toBe(false)});
it("requires options for selection fields",()=>{expect(questionnaireFieldSchema.safeParse({id:"industry",label:"Industry",type:"select",required:true}).success).toBe(false)});
it("enforces required responses and files",()=>{const fields=[{id:"goal",label:"Goal",type:"long_text" as const,required:true},{id:"logo",label:"Logo",type:"file" as const,required:true}];expect(()=>validateRequiredQuestionnaireFields(fields,{goal:"Grow"},[])).toThrow(/logo/);expect(()=>validateRequiredQuestionnaireFields(fields,{goal:"Grow quickly"},["organizations/org/questionnaires/q/logo/file.svg"])).not.toThrow()});
it("routes all required production agents",()=>{expect(questionnaireAgentPlan.map(item=>item.agentId)).toEqual(["website-architect","ui-ux-designer","content","seo"]);expect(questionnaireAgentPlan.filter(item=>item.approvalRequired)).toHaveLength(2)});
});
