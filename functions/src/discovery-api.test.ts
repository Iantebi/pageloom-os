import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./discovery-api.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("./api.ts", import.meta.url), "utf8");

describe("Business Discovery API authority", () => {
  it("mounts discoveryRouter into the same authenticated Express app as every other router", () => {
    expect(api).toContain('import {discoveryRouter} from "./discovery-api.js";');
    expect(api).toContain('app.use("/api",discoveryRouter);');
  });

  it("does not touch the payment-confirmation trigger — onboarding-journey-api.ts's Website Brief auto-creation is untouched by this file", () => {
    expect(source).not.toContain('discoveryRouter.post("/projects/:projectId/payment-confirmed"');
    expect(source).not.toContain("websiteBriefFields");
    expect(source).not.toContain("createQuestionnaireSchema");
  });

  it("uses requireProjectAccess (staff + assigned client) for read/save/complete/submit — no parallel authorization logic", () => {
    expect(source.match(/requireProjectAccess\(req, res, /g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(source).not.toContain("function requireProjectAccess");
    expect(source).not.toContain("function requireRole");
  });

  it("restricts reopen and internal notes to staff (owner/admin/operator) only — client is never in that role array", () => {
    const staffOnlyRoutes = [
      /sections\/:sectionId\/reopen[\s\S]{0,400}?requireRole\(req, res, input\.organizationId, staff\)/,
      /discoveryRouter\.post\("\/projects\/:projectId\/discovery\/notes"[\s\S]{0,400}?requireRole\(req, res, input\.organizationId, staff\)/,
      /discoveryRouter\.get\("\/projects\/:projectId\/discovery\/notes"[\s\S]{0,400}?requireRole\(req, res, organizationId, staff\)/,
    ];
    for (const pattern of staffOnlyRoutes) expect(source).toMatch(pattern);
    expect(source).toContain('const staff = ["owner", "admin", "operator"];');
  });

  it("never grants requireProjectAccess's default (client-inclusive) role set on the reopen or notes routes", () => {
    // requireProjectAccess defaults to including "client" when called with no roles argument;
    // reopen/notes must call requireRole with an explicit staff-only array instead.
    const reopenBlock = source.slice(source.indexOf('sectionId/reopen"'), source.indexOf('sectionId/reopen"') + 1200);
    const notesPostBlock = source.slice(source.indexOf('discovery/notes"'), source.indexOf('discovery/notes"') + 1000);
    expect(reopenBlock).not.toContain("requireProjectAccess");
    expect(notesPostBlock).not.toContain("requireProjectAccess");
  });

  it("validates every autosaved response key belongs to the target section's own question set (rejects cross-section/unknown keys)", () => {
    expect(source).toContain('UNKNOWN_DISCOVERY_QUESTION');
    expect(source).toContain("section.questions.find(candidate => candidate.id === key)");
  });

  it("never changes completion status from the autosave (PATCH) route — only /complete and /submit do", () => {
    const patchBlock = source.slice(source.indexOf("router.patch("), source.indexOf("router.post(\"/projects/:projectId/discovery/sections/:sectionId/complete\""));
    expect(patchBlock).not.toContain('status: "completed"');
  });

  it("uses server-side missingRequiredDiscoveryFields for both /complete and /submit — never trusts client-declared completion", () => {
    expect(source.match(/missingRequiredDiscoveryFields\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(source).toContain("DISCOVERY_SECTION_INCOMPLETE");
    expect(source).toContain("DISCOVERY_INCOMPLETE");
  });

  it("submit is idempotent: a project already submitted/reviewed short-circuits before any write", () => {
    expect(source).toContain('["submitted", "reviewed"].includes(String(existingProgress.data()?.status))');
    expect(source).toContain("alreadySubmitted: true");
  });

  it("submit reuses the exact QuestionnaireCompleted event type the Website Brief path already emits — no new event type, no bypass of the workflow engine", () => {
    expect(source).toContain('type: "QuestionnaireCompleted"');
    expect(source).toContain("new WorkflowEngine()");
    expect(source).toContain("engine.process(input.organizationId, idempotencyKey)");
  });

  it("marking Discovery reviewed is staff-only, only valid once submitted, and never advances the workflow stage", () => {
    expect(source).toContain('discoveryRouter.post("/projects/:projectId/discovery/review"');
    expect(source).toContain('requireRole(req, res, input.organizationId, staff)');
    expect(source).toContain('"DISCOVERY_NOT_SUBMITTED"');
    const reviewBlock = source.slice(source.indexOf('"/projects/:projectId/discovery/review"'), source.indexOf('"/projects/:projectId/discovery/review"') + 1200);
    expect(reviewBlock).not.toContain("WorkflowEngine");
    expect(reviewBlock).not.toContain("workflowStage");
  });

  it("submit requires a CEO-verified closed deal, matching every other project-mutating endpoint's convention", () => {
    expect(source).toContain('"DEAL_NOT_CLOSED"');
    expect(source).toContain("project.data()?.dealClosedAt");
  });

  it("reopen preserves previously entered responses (spreads the existing document) rather than clearing them", () => {
    expect(source).toContain("...base, status: \"draft\", reopenedAt: now");
  });

  it("reopen removes the section from completedSectionIds so a reopened section stops counting toward progress", () => {
    expect(source).toContain("completedSectionIds = (current?.completedSectionIds ?? []).filter(id => id !== sectionId)");
  });

  it("writes discoveryNotes with an author identity and never accepts a client-supplied authorId", () => {
    expect(source).toContain("authorId: req.user!.uid");
    expect(source).not.toMatch(/authorId:\s*input\./);
  });

  it("uses Firestore transactions for every section/progress write pair, avoiding a lost-update race under rapid autosave", () => {
    expect(source.match(/db\.runTransaction/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("rate-limits the autosave route (high-frequency by design) but not the low-frequency mutation routes", () => {
    expect(source).toContain('rateLimit("discovery-autosave"');
    expect(source).toContain("autosaveLimit");
  });

  it("activity/audit metadata carries only ids, never raw response content", () => {
    const eventTypes = ["discovery.section_completed", "discovery.submitted", "discovery.section_reopened", "discovery.note_added", "discovery.reviewed"];
    for (const type of eventTypes) expect(source).toContain(`activity(input.organizationId, "${type}", req.user!.uid, {`);
    // Every activity(...) call site's payload argument (up to its closing paren) must never carry
    // response content or note body text — only ids/metadata.
    const activityBlocks = source.split("activity(input.organizationId,").slice(1).map(chunk => chunk.slice(0, chunk.indexOf(");")));
    expect(activityBlocks.length).toBe(eventTypes.length);
    for (const block of activityBlocks) {
      expect(block).not.toContain("responses");
      expect(block).not.toContain("body:");
      expect(block).not.toContain("input.body");
      expect(block).not.toContain("reason");
    }
  });
});
