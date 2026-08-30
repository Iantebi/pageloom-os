import { Router } from "express";
import { acceptDigitalContract, createClosingProposal, markPaymentPaid, onboardingChecklist, paymentSchedule, salesPackages, type ClosingChecklistItem, type ClosingProposal, type ContractAcceptance, type Payment } from "@pageloom/core";
import { z } from "zod";
import { requireRole, type AuthenticatedRequest } from "./auth.js";
import { db } from "./firebase.js";
import { operationalLog, safeErrorName } from "./observability.js";

export const closingRouter = Router();

// The closing workspace (proposal -> contract -> payment -> onboarding) carries deal
// terms and payment status, so it is treated the same as other financial records:
// owner/admin can mutate it, owner/admin/operator can read it, and it lives inside the
// customer's tenant boundary so it can never be reached across organizations or customers.
const mutateRoles = ["owner", "admin"];
const readRoles = ["owner", "admin", "operator"];

type ClosingState = { id: "current"; customerId: string; proposal: ClosingProposal | null; contract: ContractAcceptance | null; payments: Payment[]; checklist: ClosingChecklistItem[]; startAt: string | null; createdAt: string; updatedAt: string; updatedBy: string };

function emptyState(customerId: string, now: string, uid: string): ClosingState {
  return { id: "current", customerId, proposal: null, contract: null, payments: [], checklist: [], startAt: null, createdAt: now, updatedAt: now, updatedBy: uid };
}

function docRef(organizationId: string, customerId: string) {
  return db.doc(`organizations/${organizationId}/customers/${customerId}/closing/current`);
}

function fail(error: unknown, res: import("express").Response) {
  if (error instanceof z.ZodError) return res.status(422).json({ error: { code: "VALIDATION_ERROR", message: error.issues.map(issue => issue.message).join(", ") } });
  // Only a deliberately thrown, already-classified domain error (e.g. "payment not found") should
  // reach the client with its own message and status. Anything else is unexpected (a Firestore
  // hiccup, a bug) and must not be reported as a 409 conflict with a leaked internal error message -
  // it needs to be logged like every other router's unhandled failure and answered generically.
  const status = (error as { status?: number }).status;
  if (typeof status === "number") return res.status(status).json({ error: { code: "CLOSING_OPERATION_FAILED", message: error instanceof Error ? error.message : "Closing operation failed" } });
  operationalLog("error", "closing.operation.failed", { errorType: safeErrorName(error) });
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "The operation failed" } });
}

closingRouter.get("/customers/:customerId/closing", async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = z.string().min(1).parse(req.query.organizationId);
    if (await requireRole(req, res, organizationId, readRoles) === undefined) return;
    const customerId = String(req.params.customerId);
    const customer = await db.doc(`organizations/${organizationId}/customers/${customerId}`).get();
    if (!customer.exists) return res.status(404).json({ error: { code: "CUSTOMER_NOT_FOUND", message: "Customer not found" } });
    const snap = await docRef(organizationId, customerId).get();
    return res.json({ data: snap.exists ? snap.data() : emptyState(customerId, new Date().toISOString(), req.user!.uid) });
  } catch (error) { return fail(error, res); }
});

closingRouter.post("/customers/:customerId/closing/proposals", async (req: AuthenticatedRequest, res) => {
  try {
    const input = z.object({ organizationId: z.string().min(1), customer: z.string().min(1).max(200), business: z.string().min(1).max(200), packageId: z.enum(salesPackages.map(item => item.id) as [string, ...string[]]), challenge: z.string().min(1).max(2000), validUntil: z.string().min(1), startAt: z.string().min(1).optional() }).parse(req.body);
    if (await requireRole(req, res, input.organizationId, mutateRoles) === undefined) return;
    const customerId = String(req.params.customerId);
    const customer = await db.doc(`organizations/${input.organizationId}/customers/${customerId}`).get();
    if (!customer.exists) return res.status(404).json({ error: { code: "CUSTOMER_NOT_FOUND", message: "Customer not found" } });
    const proposal = createClosingProposal({ customer: input.customer, business: input.business, packageId: input.packageId as ClosingProposal["package"]["id"], challenge: input.challenge, validUntil: input.validUntil });
    const now = new Date().toISOString();
    const state: ClosingState = { id: "current", customerId, proposal, contract: null, payments: input.startAt ? paymentSchedule(proposal, input.startAt) : [], checklist: onboardingChecklist(), startAt: input.startAt ?? null, createdAt: now, updatedAt: now, updatedBy: req.user!.uid };
    await docRef(input.organizationId, customerId).set(state);
    return res.status(201).json({ data: state });
  } catch (error) { return fail(error, res); }
});

closingRouter.post("/customers/:customerId/closing/sign", async (req: AuthenticatedRequest, res) => {
  try {
    const input = z.object({ organizationId: z.string().min(1), typedSignature: z.string().min(1).max(200) }).parse(req.body);
    if (await requireRole(req, res, input.organizationId, mutateRoles) === undefined) return;
    const customerId = String(req.params.customerId), ref = docRef(input.organizationId, customerId);
    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const state = snap.data() as ClosingState | undefined;
      if (!state?.proposal) throw Object.assign(new Error("Generate a proposal before requesting a signature"), { status: 409 });
      if (state.contract) return { state, alreadySigned: true };
      const contract = acceptDigitalContract({ proposalId: state.proposal.id, customerName: state.proposal.customer, agreementVersion: "1.0", acceptedTerms: true, typedSignature: input.typedSignature });
      const now = new Date().toISOString();
      const next: ClosingState = { ...state, proposal: { ...state.proposal, status: "accepted" }, contract, checklist: state.checklist.map(item => item.id === "contract" ? { ...item, complete: true } : item), updatedAt: now, updatedBy: req.user!.uid };
      tx.set(ref, next);
      return { state: next, alreadySigned: false };
    });
    return res.status(result.alreadySigned ? 200 : 201).json({ data: result.state });
  } catch (error) { const status = (error as { status?: number }).status; if (status) return res.status(status).json({ error: { code: "CONTRACT_NOT_READY", message: (error as Error).message } }); return fail(error, res); }
});

closingRouter.post("/customers/:customerId/closing/payments/:paymentId/paid", async (req: AuthenticatedRequest, res) => {
  try {
    const input = z.object({ organizationId: z.string().min(1) }).parse(req.body);
    if (await requireRole(req, res, input.organizationId, mutateRoles) === undefined) return;
    const customerId = String(req.params.customerId), paymentId = String(req.params.paymentId), ref = docRef(input.organizationId, customerId);
    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const state = snap.data() as ClosingState | undefined;
      const payment = state?.payments.find(item => item.id === paymentId);
      if (!state || !payment) throw Object.assign(new Error("Payment not found"), { status: 404 });
      if (payment.status === "paid") return { state, alreadyPaid: true };
      const now = new Date().toISOString();
      const next: ClosingState = { ...state, payments: state.payments.map(item => item.id === paymentId ? markPaymentPaid(item) : item), checklist: paymentId === "deposit" ? state.checklist.map(item => item.id === "deposit" ? { ...item, complete: true } : item) : state.checklist, updatedAt: now, updatedBy: req.user!.uid };
      tx.set(ref, next);
      return { state: next, alreadyPaid: false };
    });
    return res.status(result.alreadyPaid ? 200 : 201).json({ data: result.state });
  } catch (error) { const status = (error as { status?: number }).status; if (status) return res.status(status).json({ error: { code: "PAYMENT_NOT_FOUND", message: (error as Error).message } }); return fail(error, res); }
});

closingRouter.patch("/customers/:customerId/closing/checklist/:itemId", async (req: AuthenticatedRequest, res) => {
  try {
    const input = z.object({ organizationId: z.string().min(1), complete: z.boolean() }).parse(req.body);
    if (await requireRole(req, res, input.organizationId, mutateRoles) === undefined) return;
    const customerId = String(req.params.customerId), itemId = String(req.params.itemId), ref = docRef(input.organizationId, customerId);
    const snap = await ref.get(), state = snap.data() as ClosingState | undefined;
    if (!state?.checklist.some(item => item.id === itemId)) return res.status(404).json({ error: { code: "CHECKLIST_ITEM_NOT_FOUND", message: "Checklist item not found" } });
    const now = new Date().toISOString();
    await ref.update({ checklist: state.checklist.map(item => item.id === itemId ? { ...item, complete: input.complete } : item), updatedAt: now, updatedBy: req.user!.uid });
    return res.json({ data: { id: itemId, complete: input.complete } });
  } catch (error) { return fail(error, res); }
});
