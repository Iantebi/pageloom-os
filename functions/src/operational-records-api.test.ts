import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./operational-records-api.ts", import.meta.url), "utf8");
describe("operational records API", () => {
  it("provides validated finance, support, notification and agent-governance endpoints", () => { for (const value of ["/finance/:kind", "/support-tickets", "/projects/:projectId/support-tickets", "/notifications/:notificationId/read", "/notifications-read-all", "/agent-settings/:agentId", "maxConcurrentTasks", "dailyBudgetUsd", "requireProjectAccess", "supportDueAt", "resolution", "activity"]) expect(source).toContain(value); });
  it("lets platform administrators operate the cross-organization support queue", () => {
    expect(source).toContain("requirePlatformOrRole(req, res, input.organizationId, allowed)");
  });
  it("writes structured type/params on support notifications alongside the English title/body, so a frontend dictionary can localize them", () => {
    expect(source).toContain('type: "support_ticket_created"');
    expect(source).toContain("params: { subject: input.subject, priority: input.priority }");
    expect(source).toContain('type: "support_ticket_resolved"');
    expect(source).toContain('params: { resolution: input.resolution ?? "" }');
  });
});
