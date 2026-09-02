import { Router } from "express";
import { z } from "zod";
import {
  createRevisionRequestSchema, launchChecklist, missingRequiredQuestionnaireFields,
  recordHandoverSchema, resolveRevisionRequestSchema, DISCOVERY_TEMPLATE_VERSION,
  type LaunchChecklistItem, type RevisionRequest, type DiscoveryProgressDocument,
} from "@pageloom/core";
import { requireCeo, requireProjectAccess, requireRole, type AuthenticatedRequest } from "./auth.js";
import { db } from "./firebase.js";
import { WorkflowEngine } from "./workflow-engine.js";
import { operationalLog, safeErrorName } from "./observability.js";

export const onboardingJourneyRouter = Router();

const staff = ["owner", "admin", "operator"];
const staffBroad = ["owner", "admin", "operator", "member"];
const activity = (organizationId: string, type: string, actorId: string, payload: Record<string, unknown>) => db.collection(`organizations/${organizationId}/activity`).add({ type, actorId, payload, createdAt: new Date().toISOString() });
const notify = (organizationId: string, doc: Record<string, unknown>) => db.collection(`organizations/${organizationId}/notifications`).add({ read: false, createdAt: new Date().toISOString(), ...doc });

function fail(res: import("express").Response, error: unknown, code: string, event: string, fallback: string) {
  if (error instanceof z.ZodError) return res.status(400).json({ error: { code, message: error.issues.map(issue => issue.message).join(", ") } });
  operationalLog("error", event, { errorType: safeErrorName(error) });
  return res.status(400).json({ error: { code, message: fallback } });
}

// =================================================================================================
// 1. PAYMENT CONFIRMED — a single, explicit, Owner-only action. Never triggered automatically by a
// Stripe webhook or any scheduler (see functions/src/api.ts's stripe webhook handler, which only
// ever records the raw event — nothing reads it). Bundles exactly what the mission's step 1 asks
// for: record payment state/reference (never card details), advance the workflow through the new
// payment_confirmed stage into onboarding, and initialize Business Discovery ("אפיון העסק", see
// docs/customer-discovery-onboarding/) so the customer's portal immediately shows the Welcome +
// Discovery flow. The three workflow events below are processed synchronously (not left to the
// async Firestore trigger) purely to guarantee ordering — WorkflowEngine.process() is idempotent
// (it no-ops on an already-processed event id), so the normal trigger firing afterwards for the
// same event is harmless.
//
// Why Business Discovery and not the legacy Website Brief: this is a deliberate, approved product
// decision (docs/customer-discovery-onboarding/PRD.md §37, open decision 1) — new projects should
// not be asked to write marketing copy or fill one giant flat form. The Website Brief mechanism
// (createQuestionnaireSchema, websiteBriefFields, POST /projects/:id/questionnaires,
// POST /projects/:id/questionnaires/:id/complete) is NOT removed, NOT deprecated in code, and NOT
// touched by this change — it remains fully available as a generic, staff-created questionnaire
// tool for ad-hoc/internal use. Any project that already has a Website Brief questionnaire document
// from before this change is completely unaffected: nothing here reads, writes, or migrates
// existing questionnaire documents, and the Website Brief's own completion endpoint
// (api.ts's /questionnaires/:id/complete) is unchanged. Both mechanisms independently satisfy the
// same "questionnaire" workflow stage's exit event (QuestionnaireCompleted, emitted by
// discovery-api.ts's /discovery/submit exactly as it already was by the Website Brief's own
// completion) — so no downstream stage (assets, research, ...) needed any change.
const paymentConfirmedSchema = z.object({ organizationId: z.string().min(1), paymentReference: z.string().min(1).max(200), evidence: z.string().min(3).max(2000) });
onboardingJourneyRouter.post("/projects/:projectId/payment-confirmed", async (req: AuthenticatedRequest, res) => {
  try {
    const input = paymentConfirmedSchema.parse(req.body);
    if (await requireCeo(req, res, input.organizationId) === undefined) return;
    const projectId = String(req.params.projectId), projectRef = db.doc(`organizations/${input.organizationId}/projects/${projectId}`), project = await projectRef.get();
    if (!project.exists || !project.data()?.dealClosedAt) return res.status(409).json({ error: { code: "DEAL_NOT_CLOSED", message: "Payment confirmation requires a CEO-verified closed deal" } });
    const customerId = String(project.data()!.customerId ?? "");
    if (!customerId) return res.status(409).json({ error: { code: "CUSTOMER_MISSING", message: "Project has no associated customer" } });
    const customerRef = db.doc(`organizations/${input.organizationId}/customers/${customerId}`);
    const currentStage = String(project.data()?.workflowStage ?? "lead");
    const now = new Date().toISOString();

    // Idempotent: confirming payment twice for the same project just returns the current state.
    if (currentStage !== "lead" && currentStage !== "phone_call" && currentStage !== "closed_won") {
      return res.status(200).json({ data: { projectId, workflowStage: currentStage, alreadyConfirmed: true } });
    }

    await customerRef.update({ paymentStatus: "paid", paymentReference: input.paymentReference, paymentConfirmedAt: now, paymentConfirmedBy: req.user!.uid, updatedAt: now });

    const engine = new WorkflowEngine();
    const paymentEventId = await engine.emit({ organizationId: input.organizationId, projectId, type: "PaymentConfirmed", source: "api", sourceId: req.user!.uid, payload: { paymentReference: input.paymentReference, evidence: input.evidence }, occurredAt: now, idempotencyKey: `payment-confirmed-${projectId}` });
    await engine.process(input.organizationId, paymentEventId);
    const onboardingStartedId = await engine.emit({ organizationId: input.organizationId, projectId, type: "OnboardingStarted", source: "api", sourceId: req.user!.uid, payload: {}, occurredAt: now, idempotencyKey: `onboarding-started-${projectId}` });
    await engine.process(input.organizationId, onboardingStartedId);

    // Initialize Business Discovery (not the legacy Website Brief — see the comment above) so it's
    // waiting the moment the customer opens the portal, then advance straight into the
    // "questionnaire" stage — discovery-api.ts's GET /projects/:id/discovery and its section
    // save/complete/submit endpoints are what the customer's portal will call next, and /submit
    // already requires the project to be sitting in "questionnaire" (via its own dealClosedAt +
    // idempotent-status checks) exactly like the Website Brief's completion did.
    const discoveryProgress: DiscoveryProgressDocument = { id: "current", projectId, templateVersion: DISCOVERY_TEMPLATE_VERSION, status: "not_started", completedSectionIds: [], percentComplete: 0, lastActivityAt: now };
    await db.doc(`organizations/${input.organizationId}/projects/${projectId}/discoveryProgress/current`).set(discoveryProgress);
    const onboardingCompletedId = await engine.emit({ organizationId: input.organizationId, projectId, type: "OnboardingCompleted", source: "api", sourceId: req.user!.uid, payload: { discoveryInitialized: true, templateVersion: DISCOVERY_TEMPLATE_VERSION }, occurredAt: now, idempotencyKey: `onboarding-completed-${projectId}` });
    await engine.process(input.organizationId, onboardingCompletedId);

    await notify(input.organizationId, { audience: "customer", customerId, projectId, title: "Payment received — welcome to PageLoom", body: "Your project is open. Please complete your Business Discovery to get started.", type: "payment_confirmed", params: { projectId }, });
    await activity(input.organizationId, "payment.confirmed", req.user!.uid, { projectId, customerId, paymentReference: input.paymentReference });
    return res.status(202).json({ data: { projectId, customerId } });
  } catch (error) { return fail(res, error, "PAYMENT_CONFIRMATION_FAILED", "onboarding.payment_confirmed.failed", "Payment confirmation failed"); }
});

// =================================================================================================
// 6. REVISION REQUESTS — structured, recorded, resolvable. Distinct from (and complementary to) the
// existing CustomerRequestedRevision workflow event, which still drives the project's overall stage;
// this is the durable detail of *what* is being asked for, replacing ad-hoc WhatsApp threads.
onboardingJourneyRouter.post("/projects/:projectId/revision-requests", async (req: AuthenticatedRequest, res) => {
  try {
    const input = createRevisionRequestSchema.parse(req.body), projectId = String(req.params.projectId);
    const member = await requireProjectAccess(req, res, input.organizationId, projectId); if (member === undefined) return;
    const project = await db.doc(`organizations/${input.organizationId}/projects/${projectId}`).get();
    if (!project.exists) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    const ref = db.collection(`organizations/${input.organizationId}/projects/${projectId}/revisionRequests`).doc(), now = new Date().toISOString();
    const record: RevisionRequest = { id: ref.id, projectId, description: input.description, status: "open", createdBy: req.user!.uid, createdAt: now, ...(input.area ? { area: input.area } : {}) };
    await ref.set(record);
    await notify(input.organizationId, { audience: "owner", customerId: project.data()?.customerId ?? null, projectId, title: "New revision request", body: input.description.slice(0, 200), type: "revision_received", params: { area: input.area ?? "" } });
    await activity(input.organizationId, "revision_request.created", req.user!.uid, { projectId, revisionRequestId: ref.id });
    return res.status(201).json({ data: record });
  } catch (error) { return fail(res, error, "INVALID_REVISION_REQUEST", "onboarding.revision_request.create_failed", "Could not record revision request"); }
});

onboardingJourneyRouter.patch("/projects/:projectId/revision-requests/:requestId/resolve", async (req: AuthenticatedRequest, res) => {
  try {
    const input = resolveRevisionRequestSchema.parse(req.body), projectId = String(req.params.projectId), requestId = String(req.params.requestId);
    if (await requireRole(req, res, input.organizationId, staff) === undefined) return;
    const ref = db.doc(`organizations/${input.organizationId}/projects/${projectId}/revisionRequests/${requestId}`), snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Revision request not found" } });
    const project = await db.doc(`organizations/${input.organizationId}/projects/${projectId}`).get(), now = new Date().toISOString();
    await ref.update({ status: "resolved", resolvedBy: req.user!.uid, resolvedAt: now, resolutionNote: input.resolutionNote });
    await notify(input.organizationId, { audience: "customer", customerId: project.data()?.customerId ?? null, projectId, title: "Revision request resolved", body: input.resolutionNote, type: "revision_resolved", params: {} });
    await activity(input.organizationId, "revision_request.resolved", req.user!.uid, { projectId, revisionRequestId: requestId });
    return res.json({ data: { id: requestId, status: "resolved" } });
  } catch (error) { return fail(res, error, "INVALID_REVISION_RESOLUTION", "onboarding.revision_request.resolve_failed", "Could not resolve revision request"); }
});

// =================================================================================================
// 7. PUBLISH — a launch readiness checklist. Purely a visibility/readiness aid: it does not itself
// authorize a deployment. The existing CEO-approval gates (ceo_approval / final_deployment stages,
// unchanged) remain the only thing that can move a project into production.
onboardingJourneyRouter.get("/projects/:projectId/launch-checklist", async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = z.string().min(1).parse(req.query.organizationId), projectId = String(req.params.projectId);
    if (await requireRole(req, res, organizationId, staffBroad) === undefined) return;
    const ref = db.doc(`organizations/${organizationId}/projects/${projectId}/launchChecklist/current`), snap = await ref.get();
    if (snap.exists) return res.json({ data: snap.data() });
    const now = new Date().toISOString(), items = launchChecklist(), state = { id: "current", items, updatedAt: now };
    await ref.set(state);
    return res.json({ data: state });
  } catch (error) { return fail(res, error, "LAUNCH_CHECKLIST_LOAD_FAILED", "onboarding.launch_checklist.load_failed", "Could not load launch checklist"); }
});

onboardingJourneyRouter.patch("/projects/:projectId/launch-checklist/:itemId", async (req: AuthenticatedRequest, res) => {
  try {
    const input = z.object({ organizationId: z.string().min(1), complete: z.boolean() }).parse(req.body), projectId = String(req.params.projectId), itemId = String(req.params.itemId);
    if (await requireRole(req, res, input.organizationId, staff) === undefined) return;
    const ref = db.doc(`organizations/${input.organizationId}/projects/${projectId}/launchChecklist/current`), snap = await ref.get();
    const items: LaunchChecklistItem[] = snap.exists ? (snap.data()!.items as LaunchChecklistItem[]) : launchChecklist();
    if (!items.some(item => item.id === itemId)) return res.status(404).json({ error: { code: "CHECKLIST_ITEM_NOT_FOUND", message: "Checklist item not found" } });
    const now = new Date().toISOString(), next = items.map(item => item.id === itemId ? { ...item, complete: input.complete } : item);
    await ref.set({ id: "current", items: next, updatedAt: now, updatedBy: req.user!.uid });
    return res.json({ data: { id: itemId, complete: input.complete } });
  } catch (error) { return fail(res, error, "LAUNCH_CHECKLIST_UPDATE_FAILED", "onboarding.launch_checklist.update_failed", "Could not update launch checklist"); }
});

// =================================================================================================
// 8. HANDOVER — recorded once at launch, then visible to both the customer (their own project) and
// staff. Feeds project.websiteUrl, which the existing portal UI already reads to show a live-site
// link (see apps/web/src/app/(product)/portal/page.tsx).
onboardingJourneyRouter.post("/projects/:projectId/handover", async (req: AuthenticatedRequest, res) => {
  try {
    const input = recordHandoverSchema.parse(req.body), projectId = String(req.params.projectId);
    if (await requireCeo(req, res, input.organizationId) === undefined) return;
    const projectRef = db.doc(`organizations/${input.organizationId}/projects/${projectId}`), project = await projectRef.get();
    if (!project.exists) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    const now = new Date().toISOString();
    const record = { id: "current" as const, liveUrl: input.liveUrl, supportInstructions: input.supportInstructions, maintenanceInfo: input.maintenanceInfo, pageloomResponsibilities: input.pageloomResponsibilities, customerResponsibilities: input.customerResponsibilities, createdBy: req.user!.uid, createdAt: now };
    const batch = db.batch();
    batch.set(db.doc(`organizations/${input.organizationId}/projects/${projectId}/handover/current`), record);
    batch.update(projectRef, { websiteUrl: input.liveUrl, updatedAt: now });
    await batch.commit();
    await notify(input.organizationId, { audience: "customer", customerId: project.data()?.customerId ?? null, projectId, title: "Your website is live", body: input.liveUrl, type: "website_live", params: { liveUrl: input.liveUrl } });
    await activity(input.organizationId, "handover.recorded", req.user!.uid, { projectId, liveUrl: input.liveUrl });
    return res.status(201).json({ data: record });
  } catch (error) { return fail(res, error, "HANDOVER_FAILED", "onboarding.handover.failed", "Could not record handover"); }
});

onboardingJourneyRouter.get("/projects/:projectId/handover", async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = z.string().min(1).parse(req.query.organizationId), projectId = String(req.params.projectId);
    if (await requireProjectAccess(req, res, organizationId, projectId) === undefined) return;
    const snap = await db.doc(`organizations/${organizationId}/projects/${projectId}/handover/current`).get();
    return res.json({ data: snap.exists ? snap.data() : null });
  } catch (error) { return fail(res, error, "HANDOVER_LOAD_FAILED", "onboarding.handover.load_failed", "Could not load handover"); }
});

// =================================================================================================
// 10. OWNER CONTROL — one aggregation read per organization: onboarding stage, whether the customer
// or PageLoom needs to act next, missing materials, open revisions, launch readiness. Read-only;
// mutates nothing. Bounded to 100 projects to keep this a single fast page load, matching the
// existing /api/dashboard/:organizationId aggregation endpoint's own fan-out pattern.
onboardingJourneyRouter.get("/organizations/:organizationId/onboarding-overview", async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = String(req.params.organizationId);
    if (await requireRole(req, res, organizationId, staffBroad) === undefined) return;
    const projectsSnap = await db.collection(`organizations/${organizationId}/projects`).limit(200).get();
    const onboardingProjects = projectsSnap.docs.filter(projectDoc => Boolean(projectDoc.data().dealClosedAt)).slice(0, 100);
    const overview = await Promise.all(onboardingProjects.map(async projectDoc => {
      const project = projectDoc.data(), projectId = projectDoc.id;
      const [questionnaires, revisions, checklist, discoveryProgress] = await Promise.all([
        db.collection(`organizations/${organizationId}/projects/${projectId}/questionnaires`).orderBy("version", "desc").limit(1).get(),
        db.collection(`organizations/${organizationId}/projects/${projectId}/revisionRequests`).where("status", "==", "open").get(),
        db.doc(`organizations/${organizationId}/projects/${projectId}/launchChecklist/current`).get(),
        db.doc(`organizations/${organizationId}/projects/${projectId}/discoveryProgress/current`).get(),
      ]);
      const brief = questionnaires.docs[0]?.data();
      const missingMaterials = brief && brief.status !== "completed" ? missingRequiredQuestionnaireFields(brief.fields, brief.responses ?? {}, brief.filePaths ?? []) : [];
      const checklistItems: LaunchChecklistItem[] = checklist.exists ? checklist.data()!.items : [];
      const launchReady = checklistItems.length > 0 && checklistItems.filter(item => item.required).every(item => item.complete);
      const stage = String(project.workflowStage ?? project.journeyStage ?? "lead");
      const customerActionStages = new Set(["onboarding", "questionnaire", "assets", "customer_review"]);
      return {
        projectId, name: project.name as string, customerId: project.customerId as string ?? null,
        workflowStage: stage,
        actionRequired: customerActionStages.has(stage) ? "customer" : project.blockedReason ? "owner" : "none",
        missingMaterials,
        lastActivityAt: project.updatedAt as string,
        nextAction: project.nextWorkflowStage ?? null,
        overdue: Boolean(project.blockedReason),
        openRevisionCount: revisions.size,
        finalApprovalRecorded: Boolean(project.customerApprovedAt),
        launchReady,
        // Business Discovery — read-only rollup, computed live from discoveryProgress/current
        // (which may not exist yet for a project that hasn't started it). See
        // docs/customer-discovery-onboarding/PRD.md §16 and SECURITY.md §4.
        discoveryStatus: discoveryProgress.exists ? String(discoveryProgress.data()?.status) : "not_started",
        discoveryPercent: discoveryProgress.exists ? Number(discoveryProgress.data()?.percentComplete ?? 0) : 0,
        discoverySubmittedAt: discoveryProgress.exists ? (discoveryProgress.data()?.submittedAt ?? null) : null,
      };
    }));
    return res.json({ data: overview });
  } catch (error) { return fail(res, error, "ONBOARDING_OVERVIEW_FAILED", "onboarding.overview.failed", "Could not load onboarding overview"); }
});
