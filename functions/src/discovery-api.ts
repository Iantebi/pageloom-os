import { Router } from "express";
import { z } from "zod";
import {
  discoverySectionIdSchema, saveDiscoverySectionSchema, submitDiscoverySchema,
  reopenDiscoverySectionSchema, discoveryNoteSchema,
  discoverySectionOrder, discoverySection, discoveryQuestion, missingRequiredDiscoveryFields,
  discoveryProgressPercent, DISCOVERY_TEMPLATE_VERSION,
  type DiscoverySectionId, type DiscoveryResponses,
  type DiscoverySectionDocument, type DiscoveryProgressDocument, type DiscoveryNoteDocument,
} from "@pageloom/core";
import { requireProjectAccess, requireRole, type AuthenticatedRequest } from "./auth.js";
import { db } from "./firebase.js";
import { WorkflowEngine } from "./workflow-engine.js";
import { rateLimit, uidKey } from "./rate-limit.js";
import { operationalLog, safeErrorName } from "./observability.js";

// Business Discovery ("אפיון העסק") — see docs/customer-discovery-onboarding/{ARCHITECTURE,SECURITY,DATA-MODEL}.md.
// This router does NOT change which questionnaire mechanism gets auto-created when Owner confirms
// payment (onboarding-journey-api.ts's payment-confirmed handler is untouched) — that trigger
// decision is explicitly deferred pending review. Every route below is additive: it works standalone
// against any project a caller is authorized for, and /submit drives the SAME WorkflowStage
// ("questionnaire" -> "assets") transition the existing Website Brief path already drives, via the
// same QuestionnaireCompleted event — so wiring Discovery into the real onboarding flow later is a
// change to *what gets created at payment time*, not a change to how Discovery itself behaves.
export const discoveryRouter = Router();

const staff = ["owner", "admin", "operator"];
const activity = (organizationId: string, type: string, actorId: string, payload: Record<string, unknown>) => db.collection(`organizations/${organizationId}/activity`).add({ type, actorId, payload, createdAt: new Date().toISOString() });
const notify = (organizationId: string, doc: Record<string, unknown>) => db.collection(`organizations/${organizationId}/notifications`).add({ read: false, createdAt: new Date().toISOString(), ...doc });

function fail(res: import("express").Response, error: unknown, code: string, event: string, fallback: string) {
  if (error instanceof z.ZodError) return res.status(400).json({ error: { code, message: error.issues.map(issue => issue.message).join(", ") } });
  operationalLog("error", event, { errorType: safeErrorName(error) });
  return res.status(400).json({ error: { code, message: fallback } });
}

function parseSectionId(raw: unknown, res: import("express").Response): DiscoverySectionId | undefined {
  const parsed = discoverySectionIdSchema.safeParse(raw);
  if (!parsed.success) { res.status(404).json({ error: { code: "DISCOVERY_SECTION_NOT_FOUND", message: "Unknown discovery section" } }); return undefined; }
  return parsed.data;
}

function progressRef(organizationId: string, projectId: string) { return db.doc(`organizations/${organizationId}/projects/${projectId}/discoveryProgress/current`); }
function sectionRef(organizationId: string, projectId: string, sectionId: DiscoverySectionId) { return db.doc(`organizations/${organizationId}/projects/${projectId}/discovery/${sectionId}`); }

// =================================================================================================
// GET the full Discovery state for a project — every existing section document plus the progress
// rollup. The question *structure* (labels, types, conditional rules) is never serialized over this
// endpoint: both apps/web and functions already depend on @pageloom/core directly, so the client
// imports discoveryTemplate/isQuestionVisible itself rather than the server re-shipping fixed,
// versioned, code-defined data on every request.
discoveryRouter.get("/projects/:projectId/discovery", async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = z.string().min(1).parse(req.query.organizationId), projectId = String(req.params.projectId);
    if (await requireProjectAccess(req, res, organizationId, projectId) === undefined) return;
    const [progressSnap, sectionSnaps] = await Promise.all([
      progressRef(organizationId, projectId).get(),
      Promise.all(discoverySectionOrder.map(sectionId => sectionRef(organizationId, projectId, sectionId).get())),
    ]);
    const sections: Record<string, DiscoverySectionDocument> = {};
    for (const snap of sectionSnaps) if (snap.exists) sections[snap.id] = snap.data() as DiscoverySectionDocument;
    const progress = progressSnap.exists ? (progressSnap.data() as DiscoveryProgressDocument) : null;
    return res.json({ data: { progress, sections } });
  } catch (error) { return fail(res, error, "DISCOVERY_LOAD_FAILED", "discovery.load_failed", "Could not load Discovery"); }
});

// =================================================================================================
// PATCH one section's draft responses — the autosave endpoint. Merges the given keys into the
// section's existing responses (so a single-field save doesn't clobber sibling answers already
// saved), lazily creates the section document and the progress rollup on first write, and never
// changes completion status — only /complete and /submit do that, per the "meaningful completion"
// requirement (a customer must not get completion credit for merely visiting a section).
const autosaveLimit = rateLimit("discovery-autosave", { windowMs: 5 * 60_000, max: 180 }, uidKey);
discoveryRouter.patch("/projects/:projectId/discovery/sections/:sectionId", autosaveLimit, async (req: AuthenticatedRequest, res) => {
  try {
    const input = saveDiscoverySectionSchema.parse(req.body), projectId = String(req.params.projectId);
    const sectionId = parseSectionId(req.params.sectionId, res); if (sectionId === undefined) return;
    if (await requireProjectAccess(req, res, input.organizationId, projectId) === undefined) return;
    const section = discoverySection(sectionId);
    for (const key of Object.keys(input.responses)) {
      const question = section.questions.find(candidate => candidate.id === key);
      if (!question) return res.status(400).json({ error: { code: "UNKNOWN_DISCOVERY_QUESTION", message: `"${key}" is not a question in section "${sectionId}"` } });
    }
    const now = new Date().toISOString(), secRef = sectionRef(input.organizationId, projectId, sectionId), progRef = progressRef(input.organizationId, projectId);
    await db.runTransaction(async tx => {
      const [secSnap, progSnap] = await Promise.all([tx.get(secRef), tx.get(progRef)]);
      const existingResponses = secSnap.exists ? (secSnap.data()!.responses as DiscoveryResponses) : {};
      const nextDoc: DiscoverySectionDocument = secSnap.exists
        ? { ...(secSnap.data() as DiscoverySectionDocument), responses: { ...existingResponses, ...input.responses }, updatedAt: now, updatedBy: req.user!.uid }
        : { id: sectionId, projectId, templateVersion: DISCOVERY_TEMPLATE_VERSION, status: "draft", responses: input.responses, updatedAt: now, updatedBy: req.user!.uid };
      tx.set(secRef, nextDoc);
      if (!progSnap.exists) {
        const fresh: DiscoveryProgressDocument = { id: "current", projectId, templateVersion: DISCOVERY_TEMPLATE_VERSION, status: "in_progress", startedAt: now, currentSectionId: sectionId, completedSectionIds: [], percentComplete: 0, lastActivityAt: now };
        tx.set(progRef, fresh);
      } else {
        const current = progSnap.data() as DiscoveryProgressDocument;
        tx.update(progRef, { status: current.status === "not_started" ? "in_progress" : current.status, currentSectionId: sectionId, lastActivityAt: now });
      }
    });
    return res.json({ data: { id: sectionId, status: "draft", updatedAt: now } });
  } catch (error) { return fail(res, error, "DISCOVERY_SAVE_FAILED", "discovery.section_save_failed", "Could not save Discovery answers"); }
});

// =================================================================================================
// POST mark one section complete — server-side required-field validation (conditional-visibility
// aware, via the same isQuestionVisible used by missingRequiredDiscoveryFields) is the real gate;
// the client's own inline validation is advisory only, matching this codebase's existing
// missingRequiredQuestionnaireFields convention for the Website Brief.
discoveryRouter.post("/projects/:projectId/discovery/sections/:sectionId/complete", async (req: AuthenticatedRequest, res) => {
  try {
    const input = z.object({ organizationId: z.string().min(1) }).parse(req.body), projectId = String(req.params.projectId);
    const sectionId = parseSectionId(req.params.sectionId, res); if (sectionId === undefined) return;
    if (await requireProjectAccess(req, res, input.organizationId, projectId) === undefined) return;
    const section = discoverySection(sectionId), secRef = sectionRef(input.organizationId, projectId, sectionId), progRef = progressRef(input.organizationId, projectId);
    const secSnap = await secRef.get();
    const responses = secSnap.exists ? (secSnap.data()!.responses as DiscoveryResponses) : {};
    const missing = missingRequiredDiscoveryFields(section, responses);
    if (missing.length > 0) return res.status(422).json({ error: { code: "DISCOVERY_SECTION_INCOMPLETE", message: "Required questions are still unanswered", missingFields: missing } });
    const now = new Date().toISOString();
    await db.runTransaction(async tx => {
      const [secSnap2, progSnap] = await Promise.all([tx.get(secRef), tx.get(progRef)]);
      const base: DiscoverySectionDocument = secSnap2.exists ? (secSnap2.data() as DiscoverySectionDocument) : { id: sectionId, projectId, templateVersion: DISCOVERY_TEMPLATE_VERSION, status: "draft", responses, updatedAt: now, updatedBy: req.user!.uid };
      tx.set(secRef, { ...base, status: "completed", completedAt: now, completedBy: req.user!.uid, updatedAt: now });
      const current = progSnap.exists ? (progSnap.data() as DiscoveryProgressDocument) : undefined;
      const completedSectionIds = Array.from(new Set([...(current?.completedSectionIds ?? []), sectionId]));
      const next: DiscoveryProgressDocument = {
        id: "current", projectId, templateVersion: DISCOVERY_TEMPLATE_VERSION,
        status: !current || current.status === "not_started" ? "in_progress" : current.status,
        ...(current?.startedAt ? { startedAt: current.startedAt } : { startedAt: now }),
        currentSectionId: sectionId, completedSectionIds, percentComplete: discoveryProgressPercent(completedSectionIds), lastActivityAt: now,
      };
      tx.set(progRef, next, { merge: true });
    });
    await activity(input.organizationId, "discovery.section_completed", req.user!.uid, { projectId, sectionId });
    return res.json({ data: { id: sectionId, status: "completed" } });
  } catch (error) { return fail(res, error, "DISCOVERY_SECTION_COMPLETE_FAILED", "discovery.section_complete_failed", "Could not complete Discovery section"); }
});

// =================================================================================================
// POST submit the whole Discovery — validates every required, currently-visible question across all
// 9 sections, then emits the SAME QuestionnaireCompleted workflow event the Website Brief's own
// completion already emits (functions/src/api.ts's /questionnaires/:id/complete), advancing
// "questionnaire" -> "assets" exactly as today. Idempotent: resubmitting an already-submitted
// Discovery just returns the current state, matching the Website Brief's own idempotency pattern.
discoveryRouter.post("/projects/:projectId/discovery/submit", async (req: AuthenticatedRequest, res) => {
  try {
    const input = submitDiscoverySchema.parse(req.body), projectId = String(req.params.projectId);
    if (await requireProjectAccess(req, res, input.organizationId, projectId) === undefined) return;
    const projectRef = db.doc(`organizations/${input.organizationId}/projects/${projectId}`), project = await projectRef.get();
    if (!project.exists) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    if (!project.data()?.dealClosedAt) return res.status(409).json({ error: { code: "DEAL_NOT_CLOSED", message: "Discovery submission requires a CEO-verified closed deal" } });

    const progRef = progressRef(input.organizationId, projectId);
    const existingProgress = await progRef.get();
    if (existingProgress.exists && ["submitted", "reviewed"].includes(String(existingProgress.data()?.status))) {
      return res.status(200).json({ data: { projectId, status: existingProgress.data()!.status, alreadySubmitted: true } });
    }

    const sectionSnaps = await Promise.all(discoverySectionOrder.map(sectionId => sectionRef(input.organizationId, projectId, sectionId).get()));
    const missingBySection: Record<string, string[]> = {};
    sectionSnaps.forEach((snap, index) => {
      const sectionId = discoverySectionOrder[index]!;
      const responses = snap.exists ? (snap.data()!.responses as DiscoveryResponses) : {};
      const missing = missingRequiredDiscoveryFields(discoverySection(sectionId), responses);
      if (missing.length > 0) missingBySection[sectionId] = missing;
    });
    if (Object.keys(missingBySection).length > 0) {
      return res.status(422).json({ error: { code: "DISCOVERY_INCOMPLETE", message: "Some required Discovery questions are still unanswered", missingBySection } });
    }

    const now = new Date().toISOString();
    await db.runTransaction(async tx => {
      const snaps = await Promise.all(discoverySectionOrder.map(sectionId => tx.get(sectionRef(input.organizationId, projectId, sectionId))));
      snaps.forEach((snap, index) => {
        const sectionId = discoverySectionOrder[index]!;
        if (snap.exists && snap.data()?.status === "completed") return;
        const responses = snap.exists ? (snap.data()!.responses as DiscoveryResponses) : {};
        tx.set(sectionRef(input.organizationId, projectId, sectionId), { id: sectionId, projectId, templateVersion: DISCOVERY_TEMPLATE_VERSION, responses, updatedAt: now, updatedBy: req.user!.uid, status: "completed", completedAt: now, completedBy: req.user!.uid });
      });
      const currentProgress = await tx.get(progRef);
      const next: DiscoveryProgressDocument = {
        id: "current", projectId, templateVersion: DISCOVERY_TEMPLATE_VERSION, status: "submitted",
        ...(currentProgress.data()?.startedAt ? { startedAt: currentProgress.data()!.startedAt } : { startedAt: now }),
        submittedAt: now, completedSectionIds: [...discoverySectionOrder], percentComplete: 100, lastActivityAt: now,
      };
      tx.set(progRef, next, { merge: true });
      tx.update(projectRef, { journeyStage: "assets", status: "active", websiteStatus: "assets", aiExecutionStatus: "waiting_for_assets", updatedAt: now });
    });

    const engine = new WorkflowEngine(), idempotencyKey = `discovery-submitted-${projectId}-v${DISCOVERY_TEMPLATE_VERSION}`;
    await engine.emit({ organizationId: input.organizationId, projectId, type: "QuestionnaireCompleted", source: "api", sourceId: req.user!.uid, payload: { source: "business_discovery", templateVersion: DISCOVERY_TEMPLATE_VERSION }, occurredAt: now, idempotencyKey });
    await engine.process(input.organizationId, idempotencyKey);
    await notify(input.organizationId, { audience: "owner", customerId: project.data()?.customerId ?? null, projectId, title: "Business Discovery submitted", body: `${project.data()?.name ?? "A project"}'s Business Discovery was submitted`, type: "discovery_submitted", params: { projectName: project.data()?.name ?? "" } });
    await activity(input.organizationId, "discovery.submitted", req.user!.uid, { projectId, workflowEventId: idempotencyKey });
    return res.status(202).json({ data: { projectId, status: "submitted", workflowEventId: idempotencyKey } });
  } catch (error) { return fail(res, error, "DISCOVERY_SUBMIT_FAILED", "discovery.submit_failed", "Could not submit Discovery"); }
});

// =================================================================================================
// POST reopen a completed section — Owner/Admin/Operator only, never a client, even one who owns the
// project (matches the mission's "customer must never grant themselves back the ability to bypass
// staff review" implicitly, and mirrors launch-checklist's staff-only mutation role set). Preserves
// previously entered responses; nothing is cleared. Recomputes progress so a reopened section no
// longer counts toward "meaningful completion" until it is completed again.
discoveryRouter.post("/projects/:projectId/discovery/sections/:sectionId/reopen", async (req: AuthenticatedRequest, res) => {
  try {
    const input = reopenDiscoverySectionSchema.parse(req.body), projectId = String(req.params.projectId);
    const sectionId = parseSectionId(req.params.sectionId, res); if (sectionId === undefined) return;
    if (await requireRole(req, res, input.organizationId, staff) === undefined) return;
    const project = await db.doc(`organizations/${input.organizationId}/projects/${projectId}`).get();
    if (!project.exists) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    const secRef = sectionRef(input.organizationId, projectId, sectionId), progRef = progressRef(input.organizationId, projectId);
    const now = new Date().toISOString();
    await db.runTransaction(async tx => {
      const [secSnap, progSnap] = await Promise.all([tx.get(secRef), tx.get(progRef)]);
      const base: DiscoverySectionDocument = secSnap.exists ? (secSnap.data() as DiscoverySectionDocument) : { id: sectionId, projectId, templateVersion: DISCOVERY_TEMPLATE_VERSION, status: "draft", responses: {}, updatedAt: now, updatedBy: req.user!.uid };
      tx.set(secRef, { ...base, status: "draft", reopenedAt: now, reopenedBy: req.user!.uid, reopenReason: input.reason, updatedAt: now });
      const current = progSnap.exists ? (progSnap.data() as DiscoveryProgressDocument) : undefined;
      const completedSectionIds = (current?.completedSectionIds ?? []).filter(id => id !== sectionId);
      const next: DiscoveryProgressDocument = {
        id: "current", projectId, templateVersion: DISCOVERY_TEMPLATE_VERSION, status: "reopened",
        ...(current?.startedAt ? { startedAt: current.startedAt } : { startedAt: now }),
        ...(current?.submittedAt ? { submittedAt: current.submittedAt } : {}),
        completedSectionIds, percentComplete: discoveryProgressPercent(completedSectionIds), lastActivityAt: now,
      };
      tx.set(progRef, next, { merge: true });
    });
    await notify(input.organizationId, { audience: "customer", customerId: project.data()?.customerId ?? null, projectId, title: "More information needed", body: input.reason, type: "discovery_information_requested", params: { sectionId } });
    await activity(input.organizationId, "discovery.section_reopened", req.user!.uid, { projectId, sectionId });
    return res.json({ data: { id: sectionId, status: "draft" } });
  } catch (error) { return fail(res, error, "DISCOVERY_REOPEN_FAILED", "discovery.section_reopen_failed", "Could not reopen Discovery section"); }
});

// =================================================================================================
// POST mark Discovery reviewed — purely a staff visibility/readiness flag (mirrors
// launch-checklist's "purely a visibility aid, does not itself authorize anything" pattern from
// onboarding-journey-api.ts). Does not touch the workflow stage or require anything of the
// customer; only meaningful once status is already "submitted".
discoveryRouter.post("/projects/:projectId/discovery/review", async (req: AuthenticatedRequest, res) => {
  try {
    const input = z.object({ organizationId: z.string().min(1) }).parse(req.body), projectId = String(req.params.projectId);
    if (await requireRole(req, res, input.organizationId, staff) === undefined) return;
    const progRef = progressRef(input.organizationId, projectId), progSnap = await progRef.get();
    if (!progSnap.exists) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Discovery has not been started for this project" } });
    if (!["submitted", "reviewed"].includes(String(progSnap.data()?.status))) return res.status(409).json({ error: { code: "DISCOVERY_NOT_SUBMITTED", message: "Discovery must be submitted before it can be marked reviewed" } });
    const now = new Date().toISOString();
    await progRef.update({ status: "reviewed", reviewedAt: now, reviewedBy: req.user!.uid });
    await activity(input.organizationId, "discovery.reviewed", req.user!.uid, { projectId });
    return res.json({ data: { status: "reviewed" } });
  } catch (error) { return fail(res, error, "DISCOVERY_REVIEW_FAILED", "discovery.review_failed", "Could not mark Discovery reviewed"); }
});

// =================================================================================================
// Internal staff notes — Owner/Admin/Operator only, both to write AND to read. This role set
// deliberately excludes "client" entirely (there is no code path here a customer's access token can
// reach), which is what the Firestore rule (allow read: if staff(orgId), no clientProject() clause)
// backs up at the data layer — this endpoint is belt, the rule is suspenders.
discoveryRouter.post("/projects/:projectId/discovery/notes", async (req: AuthenticatedRequest, res) => {
  try {
    const input = discoveryNoteSchema.parse(req.body), projectId = String(req.params.projectId);
    if (await requireRole(req, res, input.organizationId, staff) === undefined) return;
    const project = await db.doc(`organizations/${input.organizationId}/projects/${projectId}`).get();
    if (!project.exists) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    const ref = db.collection(`organizations/${input.organizationId}/projects/${projectId}/discoveryNotes`).doc(), now = new Date().toISOString();
    const note: DiscoveryNoteDocument = { id: ref.id, projectId, authorId: req.user!.uid, authorName: req.user!.email ?? req.user!.uid, body: input.body, createdAt: now, ...(input.sectionId ? { sectionId: input.sectionId } : {}) };
    await ref.set(note);
    await activity(input.organizationId, "discovery.note_added", req.user!.uid, { projectId, noteId: ref.id, ...(input.sectionId ? { sectionId: input.sectionId } : {}) });
    return res.status(201).json({ data: note });
  } catch (error) { return fail(res, error, "DISCOVERY_NOTE_FAILED", "discovery.note_failed", "Could not add Discovery note"); }
});

discoveryRouter.get("/projects/:projectId/discovery/notes", async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = z.string().min(1).parse(req.query.organizationId), projectId = String(req.params.projectId);
    if (await requireRole(req, res, organizationId, staff) === undefined) return;
    const snap = await db.collection(`organizations/${organizationId}/projects/${projectId}/discoveryNotes`).orderBy("createdAt", "desc").limit(200).get();
    return res.json({ data: snap.docs.map(doc => doc.data()) });
  } catch (error) { return fail(res, error, "DISCOVERY_NOTES_LOAD_FAILED", "discovery.notes_load_failed", "Could not load Discovery notes"); }
});
