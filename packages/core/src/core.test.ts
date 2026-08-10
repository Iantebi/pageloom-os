import { describe, expect, it } from "vitest";
import { agents, assertJourneyTransition, assignJobSchema, nextJourneyStage, routeModel } from "./index.js";

describe("AI-native core", () => {
  it("registers the twenty-two single-owner agents", () => {
    expect(agents).toHaveLength(22);
    expect(new Set(agents.map((agent) => agent.id)).size).toBe(22);
    expect(agents.every((agent) => agent.preferredProvider === "gemini" && agent.fallbackProvider === "openai")).toBe(true);
    expect(agents.flatMap((agent) => agent.tools).join(" ").toLowerCase()).not.toMatch(/cms|page_builder/);
    for (const id of ["client-journey","website-architect","ui-ux-designer","frontend-builder","backend","firebase","seo","content","brand","media","qa","deployment","maintenance","analytics","crm"]) expect(agents.some((agent) => agent.id === id), `${id} is registered`).toBe(true);
  });

  it("preserves Hebrew jobs", () => {
    expect(assignJobSchema.parse({ organizationId:"org",agentId:"content",objective:"Create complete Hebrew content",locale:"he" }).locale).toBe("he");
  });

  it("enforces the sequential post-close customer journey", () => {
    expect(nextJourneyStage("deal_closed")).toBe("questionnaire");
    expect(() => assertJourneyTransition("deal_closed","planning")).toThrow(/Invalid customer journey transition/);
  });

  it("uses Gemini 2.5 Pro first and OpenAI GPT only as fallback", () => {
    const base={agent:agents[5]!,priority:"critical" as const,requiresCode:true,requiresGoogleContext:false,budgetRemainingUsd:10};
    expect(routeModel({...base,providerHealth:{openai:true,gemini:true}})).toMatchObject({provider:"gemini",model:"gemini-2.5-pro"});
    expect(routeModel({...base,providerHealth:{openai:true,gemini:false}})).toMatchObject({provider:"openai",model:"gpt-5.6-sol"});
  });
});
