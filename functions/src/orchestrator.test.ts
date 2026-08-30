import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");
describe("central orchestrator agent governance enforcement", () => {
  it("reads and enforces the owner-configured agentSettings caps before dispatch", () => {
    for (const value of ["checkAgentGovernance", "maxConcurrentTasks", "dailyBudgetUsd", "evaluateAgentConcurrency", "evaluateAgentDailyBudget", "agencyDayWindow"]) expect(source).toContain(value);
  });
  it("checks governance before claim() so a throttled task is left queued, not claimed then unwound", () => {
    const governanceIndex = source.indexOf("checkAgentGovernance(organizationId,agentId,taskId)");
    const claimIndex = source.indexOf("await this.claim(ref)");
    expect(governanceIndex).toBeGreaterThan(-1);
    expect(claimIndex).toBeGreaterThan(-1);
    expect(governanceIndex).toBeLessThan(claimIndex);
  });
  it("defers instead of throwing an unhandled error when governance blocks dispatch", () => {
    const deferBlock = source.slice(source.indexOf("if(!governance.allowed)"), source.indexOf("if(!governance.allowed)") + 160);
    expect(deferBlock).toContain("task.governance_deferred");
    expect(deferBlock).toContain("return");
    expect(deferBlock).not.toContain("throw");
  });
  it("treats an unset or zero cap as no limit, matching the governance UI's unsaved-agent default", () => {
    expect(source).toContain('Number(settings.maxConcurrentTasks??0)');
    expect(source).toContain('Number(settings.dailyBudgetUsd??0)');
    expect(source).toContain("if(maxConcurrentTasks>0)");
    expect(source).toContain("if(dailyBudgetUsd>0)");
  });
  it("scopes the concurrency check to the same agent's running tasks, excluding the task being dispatched", () => {
    expect(source).toContain('where("agentId","==",agentId).where("status","==","running")');
    expect(source).toContain("running.docs.filter(doc=>doc.id!==taskId)");
  });
  it("still claims tasks atomically via a Firestore transaction (no new duplicate-dispatch gap introduced)", () => {
    expect(source).toContain("private async claim(ref:DocumentReference){return db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists||snap.data()?.status!==\"queued\")return undefined");
  });
  it("keeps the pause check and the org-wide AI budget check intact alongside the new per-agent checks", () => {
    expect(source).toContain('agentSettings.data()?.paused===true');
    expect(source).toContain("task.budget_blocked");
  });
});
