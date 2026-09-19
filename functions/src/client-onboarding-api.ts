import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { createClientSchema, DISCOVERY_TEMPLATE_VERSION, type DiscoveryInvite, type DiscoveryProgressDocument } from "@pageloom/core";
import { auth, db } from "./firebase.js";
import { requireRole, type AuthenticatedRequest } from "./auth.js";
import { WorkflowEngine } from "./workflow-engine.js";
import { operationalLog, safeErrorName } from "./observability.js";
import { clientIpKey, rateLimit } from "./rate-limit.js";

// Standalone "New Client" onboarding (2026-09-20) — see docs/client-playbook/02-create-client.md.
// Deliberately independent of the CRM (packages/core's client-management.ts createCustomerSchema/
// createProjectSchema, which require a lead and a closed-deal ceremony) and of Backend Master:
// this is the Customer Journey's own front door for an Owner who already has a paying customer and
// just needs to get them a Discovery link, no CRM pipeline required.

function fail(res: import("express").Response, error: unknown, code: string, event: string, fallback: string) {
  if (error instanceof z.ZodError) return res.status(400).json({ error: { code, message: error.issues.map(issue => issue.message).join(", ") } });
  operationalLog("error", event, { errorType: safeErrorName(error) });
  return res.status(400).json({ error: { code, message: fallback } });
}

// URL-safe, 32-character, 192-bit random token — the Discovery link's entire security boundary
// (see discoveryLinkRouter below): whoever holds this string can open exactly one customer's
// Discovery, nothing else. Collision odds are astronomically small; .create() below still fails
// closed instead of silently overwriting on the one-in-billions chance of a repeat.
function generateDiscoveryToken(): string {
  return randomBytes(24).toString("base64url");
}

// =================================================================================================
// STAFF SIDE — mounted behind the normal authenticate middleware, like every other staff router.
export const clientOnboardingRouter = Router();

clientOnboardingRouter.post("/clients/new", async (req: AuthenticatedRequest, res) => {
  try {
    const input = createClientSchema.parse(req.body);
    if (await requireRole(req, res, input.organizationId, ["owner", "admin", "operator"]) === undefined) return;
    const now = new Date().toISOString();
    const customerRef = db.collection(`organizations/${input.organizationId}/customers`).doc();
    const projectRef = db.collection(`organizations/${input.organizationId}/projects`).doc();

    await customerRef.set({
      id: customerRef.id, organizationId: input.organizationId,
      businessName: input.businessName, name: input.businessName,
      contactName: input.contactName, email: input.email, phone: input.phone,
      notes: input.notes ?? "", source: "direct_onboarding", status: "onboarding",
      createdAt: now, updatedAt: now, createdBy: req.user!.uid,
    });
    await projectRef.set({
      id: projectRef.id, organizationId: input.organizationId, customerId: customerRef.id,
      name: `${input.businessName} — Website`, clientName: input.businessName,
      status: "planning", journeyStage: "lead", workflowStage: "lead",
      locale: "en", progress: 0, budget: 0, revenue: 0, cost: 0,
      dealClosedAt: now, dealClosedBy: req.user!.uid,
      createdAt: now, updatedAt: now,
    });

    // Advance the REAL workflow-engine state in lockstep with the display fields above — a
    // project whose workflowStage says "onboarding" but whose engine-internal state is still
    // "lead" (e.g. from a doc written directly instead of through these events) silently drops
    // every later customer-review workflow event. See docs/client-playbook/02-create-client.md.
    const engine = new WorkflowEngine();
    const paymentEventId = await engine.emit({ organizationId: input.organizationId, projectId: projectRef.id, type: "PaymentConfirmed", source: "api", sourceId: req.user!.uid, payload: { paymentReference: "direct-onboarding", evidence: "Created via New Client onboarding" }, occurredAt: now, idempotencyKey: `payment-confirmed-${projectRef.id}` });
    await engine.process(input.organizationId, paymentEventId);
    const onboardingStartedId = await engine.emit({ organizationId: input.organizationId, projectId: projectRef.id, type: "OnboardingStarted", source: "api", sourceId: req.user!.uid, payload: {}, occurredAt: now, idempotencyKey: `onboarding-started-${projectRef.id}` });
    await engine.process(input.organizationId, onboardingStartedId);

    const discoveryProgress: DiscoveryProgressDocument = { id: "current", projectId: projectRef.id, templateVersion: DISCOVERY_TEMPLATE_VERSION, status: "not_started", completedSectionIds: [], percentComplete: 0, lastActivityAt: now };
    await db.doc(`organizations/${input.organizationId}/projects/${projectRef.id}/discoveryProgress/current`).set(discoveryProgress);

    const onboardingCompletedId = await engine.emit({ organizationId: input.organizationId, projectId: projectRef.id, type: "OnboardingCompleted", source: "api", sourceId: req.user!.uid, payload: { discoveryInitialized: true, templateVersion: DISCOVERY_TEMPLATE_VERSION }, occurredAt: now, idempotencyKey: `onboarding-completed-${projectRef.id}` });
    await engine.process(input.organizationId, onboardingCompletedId);

    const token = generateDiscoveryToken();
    const invite: DiscoveryInvite = { token, organizationId: input.organizationId, customerId: customerRef.id, projectId: projectRef.id, createdAt: now, createdBy: req.user!.uid };
    await db.doc(`discoveryInvites/${token}`).create(invite);

    const activityRef = db.collection(`organizations/${input.organizationId}/activity`).doc();
    await activityRef.set({ id: activityRef.id, type: "client.onboarded_directly", payload: { customerId: customerRef.id, projectId: projectRef.id }, createdAt: now });
    return res.status(201).json({ data: { customerId: customerRef.id, projectId: projectRef.id, token } });
  } catch (error) { return fail(res, error, "CLIENT_CREATE_FAILED", "client_onboarding.create_failed", "Could not create the client"); }
});

// =================================================================================================
// PUBLIC SIDE — mounted BEFORE the authenticate middleware (see api.ts), exactly like
// published-content-api.ts's one other fully public route. A brand-new customer has no Firebase
// session yet, so this can't require a bearer token; it's rate-limited by IP instead of uid.
export const discoveryLinkRouter = Router();
const tokenParam = z.string().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/);

discoveryLinkRouter.post("/discovery-links/:token/claim", rateLimit("discovery-link-claim", { windowMs: 60_000, max: 20 }, clientIpKey), async (req, res) => {
  try {
    const token = tokenParam.parse(req.params.token);
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "A signed-in session (even an anonymous one) is required" } });
    const decoded = await auth.verifyIdToken(header.slice(7), process.env.FUNCTIONS_EMULATOR !== "true");
    const inviteRef = db.doc(`discoveryInvites/${token}`), invite = await inviteRef.get();
    if (!invite.exists) return res.status(404).json({ error: { code: "INVITE_NOT_FOUND", message: "This Discovery link is invalid or has expired." } });
    const data = invite.data() as DiscoveryInvite;
    // Grant (idempotent) the calling uid a membership scoped to exactly this one customer/project —
    // never the customer's other projects, never any other customer. Re-claiming from a new device
    // or after clearing storage just grants the new uid the same narrow scope; nothing here widens
    // access beyond the single project this token was minted for.
    await db.doc(`organizations/${data.organizationId}/members/${decoded.uid}`).set({
      uid: decoded.uid, role: "client", customerId: data.customerId, projectIds: [data.projectId], disabled: false, createdAt: new Date().toISOString(),
    }, { merge: true });
    if (!data.claimedUid) await inviteRef.update({ claimedUid: decoded.uid, claimedAt: new Date().toISOString() });
    return res.json({ data: { organizationId: data.organizationId, projectId: data.projectId } });
  } catch (error) { return fail(res, error, "DISCOVERY_LINK_CLAIM_FAILED", "discovery_link.claim_failed", "This Discovery link could not be opened"); }
});
