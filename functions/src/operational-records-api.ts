import { Router } from "express";
import { createFinancialRecordSchema, createSupportTicketSchema, supportDueAt, updateSupportTicketSchema } from "@pageloom/core";
import { z } from "zod";
import { requireProjectAccess, requireRole, type AuthenticatedRequest } from "./auth.js";
import { db } from "./firebase.js";

export const operationalRecordsRouter = Router();
const allowed = ["owner", "admin", "operator"];
const audit = (organizationId: string, type: string, actorId: string, payload: Record<string, unknown>) => db.collection(`organizations/${organizationId}/activity`).add({ type, actorId, payload, createdAt: new Date().toISOString() });

operationalRecordsRouter.post("/finance/:kind", async (req: AuthenticatedRequest, res) => {
  try {
    const kind = z.enum(["revenue", "expenses"]).parse(req.params.kind), input = createFinancialRecordSchema.parse(req.body);
    if (await requireRole(req, res, input.organizationId, allowed) === undefined) return;
    const { organizationId, ...record } = input, ref = db.collection(`organizations/${organizationId}/${kind}`).doc(), now = new Date().toISOString();
    await ref.create({ id: ref.id, ...record, source: "manual_ledger", createdBy: req.user!.uid, createdAt: now });
    await audit(organizationId, `finance.${kind === "revenue" ? "revenue" : "expense"}.recorded`, req.user!.uid, { recordId: ref.id, amount: record.amount, currency: record.currency, category: record.category });
    return res.status(201).json({ data: { id: ref.id } });
  } catch (error) { return res.status(400).json({ error: { code: "INVALID_FINANCIAL_RECORD", message: error instanceof Error ? error.message : "Invalid financial record" } }); }
});

operationalRecordsRouter.post("/support-tickets", async (req: AuthenticatedRequest, res) => {
  try {
    const input = createSupportTicketSchema.parse(req.body);
    if (await requireRole(req, res, input.organizationId, allowed) === undefined) return;
    const [customer, project] = await Promise.all([db.doc(`organizations/${input.organizationId}/customers/${input.customerId}`).get(), input.projectId ? db.doc(`organizations/${input.organizationId}/projects/${input.projectId}`).get() : undefined]);
    if (!customer.exists || (input.projectId && (!project?.exists || project.data()?.customerId !== input.customerId))) return res.status(409).json({ error: { code: "INVALID_SUPPORT_SCOPE", message: "Customer and project must exist in the same account" } });
    const ref = db.collection(`organizations/${input.organizationId}/supportTickets`).doc(), now = new Date().toISOString();
    await ref.create({ id: ref.id, ...input, status: "open", responseDueAt: supportDueAt(input.priority, now), createdBy: req.user!.uid, createdAt: now, updatedAt: now });
    await audit(input.organizationId, "support.ticket.created", req.user!.uid, { ticketId: ref.id, customerId: input.customerId, projectId: input.projectId ?? null, priority: input.priority });
    return res.status(201).json({ data: { id: ref.id } });
  } catch (error) { return res.status(400).json({ error: { code: "INVALID_SUPPORT_TICKET", message: error instanceof Error ? error.message : "Invalid support ticket" } }); }
});

operationalRecordsRouter.post("/projects/:projectId/support-tickets", async (req: AuthenticatedRequest, res) => {
  try {
    const input = z.object({ organizationId: z.string().min(1), subject: z.string().min(3).max(200), description: z.string().min(10).max(10_000), priority: z.enum(["critical", "high", "normal", "low"]).default("normal") }).parse(req.body), projectId = String(req.params.projectId);
    if (await requireProjectAccess(req, res, input.organizationId, projectId) === undefined) return;
    const project = await db.doc(`organizations/${input.organizationId}/projects/${projectId}`).get();
    if (!project.exists || !project.data()?.customerId) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    const ref = db.collection(`organizations/${input.organizationId}/supportTickets`).doc(), now = new Date().toISOString();
    await ref.create({ id: ref.id, ...input, projectId, customerId: project.data()!.customerId, status: "open", responseDueAt: supportDueAt(input.priority, now), source: "customer_portal", createdBy: req.user!.uid, createdAt: now, updatedAt: now });
    await audit(input.organizationId, "support.ticket.customer_created", req.user!.uid, { ticketId: ref.id, customerId: project.data()!.customerId, projectId, priority: input.priority });
    return res.status(201).json({ data: { id: ref.id, responseDueAt: supportDueAt(input.priority, now) } });
  } catch (error) { return res.status(400).json({ error: { code: "INVALID_SUPPORT_TICKET", message: error instanceof Error ? error.message : "Invalid support ticket" } }); }
});

operationalRecordsRouter.patch("/support-tickets/:ticketId", async (req: AuthenticatedRequest, res) => {
  try {
    const input = updateSupportTicketSchema.parse(req.body);
    if (await requireRole(req, res, input.organizationId, allowed) === undefined) return;
    const ref = db.doc(`organizations/${input.organizationId}/supportTickets/${String(req.params.ticketId)}`), ticket = await ref.get();
    if (!ticket.exists) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Support ticket not found" } });
    const now = new Date().toISOString(), terminal = ["resolved", "closed"].includes(input.status);
    await ref.update({ status: input.status, resolution: input.resolution ?? null, updatedBy: req.user!.uid, updatedAt: now, ...(terminal ? { resolvedAt: now, resolvedBy: req.user!.uid } : {}) });
    await audit(input.organizationId, "support.ticket.status_changed", req.user!.uid, { ticketId: ref.id, from: ticket.data()?.status, to: input.status, resolution: input.resolution ?? null });
    return res.json({ data: { id: ref.id, status: input.status } });
  } catch (error) { return res.status(400).json({ error: { code: "INVALID_SUPPORT_UPDATE", message: error instanceof Error ? error.message : "Invalid support update" } }); }
});

operationalRecordsRouter.patch("/notifications/:notificationId/read", async (req: AuthenticatedRequest, res) => {
  const organizationId = z.string().min(1).parse(req.body.organizationId);
  if (await requireRole(req, res, organizationId, allowed) === undefined) return;
  const ref = db.doc(`organizations/${organizationId}/notifications/${String(req.params.notificationId)}`), notification = await ref.get();
  if (!notification.exists) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found" } });
  const now = new Date().toISOString(); await ref.update({ read: true, readAt: now, readBy: req.user!.uid });
  await audit(organizationId, "notification.acknowledged", req.user!.uid, { notificationId: ref.id });
  return res.json({ data: { id: ref.id, read: true } });
});

operationalRecordsRouter.patch("/notifications-read-all", async (req: AuthenticatedRequest, res) => {
  const organizationId = z.string().min(1).parse(req.body.organizationId);
  if (await requireRole(req, res, organizationId, allowed) === undefined) return;
  const unread = await db.collection(`organizations/${organizationId}/notifications`).where("read", "==", false).limit(500).get(), batch = db.batch(), now = new Date().toISOString();
  unread.docs.forEach(doc => batch.update(doc.ref, { read: true, readAt: now, readBy: req.user!.uid })); await batch.commit();
  await audit(organizationId, "notification.all_acknowledged", req.user!.uid, { count: unread.size });
  return res.json({ data: { count: unread.size } });
});
