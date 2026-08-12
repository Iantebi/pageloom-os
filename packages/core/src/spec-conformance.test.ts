import {describe,expect,it} from "vitest";
import {agents,customerJourney,routeModel} from "./index.js";

const requiredAgents=["ceo","sales","client-journey","project-manager","website-architect","ui-ux-designer","frontend-builder","backend","firebase","seo","content","brand","media","qa","deployment","maintenance","support","marketing","finance","analytics","automation","crm"];
const requiredJourney=["lead","ceo_call","deal_closed","questionnaire","assets","planning","ui_design","development","quality_assurance","customer_approval","deployment","support","maintenance"];

describe("enterprise specification conformance",()=>{
  it("keeps the exact ordered 22-agent registry",()=>expect(agents.map(agent=>agent.id)).toEqual(requiredAgents));
  it("does not duplicate responsibility ownership",()=>{const owners=new Map<string,string>();for(const agent of agents)for(const responsibility of agent.responsibilities){const key=responsibility.trim().toLowerCase();expect(owners.get(key),`${responsibility} overlaps ${agent.id}`).toBeUndefined();owners.set(key,agent.id)}});
  it("preserves the human-first journey order",()=>expect(customerJourney).toEqual(requiredJourney));
  it("pins Google AI Studio Pro primary and OpenAI Responses fallback",()=>{const context={agent:agents[0]!,priority:"critical" as const,requiresCode:true,requiresGoogleContext:false,budgetRemainingUsd:100};expect(routeModel({...context,providerHealth:{gemini:true,openai:true}})).toMatchObject({provider:"gemini",model:"gemini-pro-latest"});expect(routeModel({...context,providerHealth:{gemini:false,openai:true}})).toMatchObject({provider:"openai",model:"gpt-5.6-sol"})});
});
