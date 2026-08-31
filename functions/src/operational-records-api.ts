import { Router } from "express";
import { agentIdSchema, createFinancialRecordSchema, createSupportTicketSchema, supportDueAt, updateSupportTicketSchema } from "@pageloom/core";
import { z } from "zod";
import { customerPermission, requirePlatformOrRole, requireProjectAccess, requireRole, type AuthenticatedRequest } from "./auth.js";
import { db } from "./firebase.js";
import { rateLimit, uidKey } from "./rate-limit.js";
import { operationalLog, safeErrorName } from "./observability.js";

export const operationalRecordsRouter = Router();
const allowed = ["owner", "admin", "operator"];
// Notifications are staff-broad in firestore.rules (owner/admin/operator/member can all read
// organizations/{orgId}/notifications) — acknowledging one's own inbox carries no financial or
// security sensitivity, so the write-side check must match that broader tier rather than the
// privileged-only `allowed` list used for financial/ticket-management routes below.
const staffBroad = ["owner", "admin", "operator", "member"];
const audit = (organizationId: string, type: string, actorId: string, payload: Record<string, unknown>) => db.collection(`organizations/${organizationId}/activity`).add({ type, actorId, payload, createdAt: new Date().toISOString() });
// Every route below shares this: a ZodError's own issues are safe, useful validation feedback,
// but any other error (Firestore internals, etc.) is logged server-side and replaced with a fixed
// message so implementation detail is never echoed back to the caller.
function fail(res: import("express").Response, error: unknown, code: string, event: string, fallback: string) {
  if (error instanceof z.ZodError) return res.status(400).json({ error: { code, message: error.issues.map(issue => issue.message).join(", ") } });
  operationalLog("error", event, { errorType: safeErrorName(error) });
  return res.status(400).json({ error: { code, message: fallback } });
}

operationalRecordsRouter.post("/finance/:kind", async (req: AuthenticatedRequest, res) => {
  try {
    const kind = z.enum(["revenue", "expenses"]).parse(req.params.kind), input = createFinancialRecordSchema.parse(req.body);
    if (await requireRole(req, res, input.organizationId, allowed) === undefined) return;
    const { organizationId, ...record } = input, ref = db.collection(`organizations/${organizationId}/${kind}`).doc(), now = new Date().toISOString();
    await ref.create({ id: ref.id, ...record, source: "manual_ledger", createdBy: req.user!.uid, createdAt: now });
    await audit(organizationId, `finance.${kind === "revenue" ? "revenue" : "expense"}.recorded`, req.user!.uid, { recordId: ref.id, amount: record.amount, currency: record.currency, category: record.category });
    return res.status(201).json({ data: { id: ref.id } });
  } catch (error) { return fail(res, error, "INVALID_FINANCIAL_RECORD", "operational_records.finance.failed", "Invalid financial record"); }
});

// Staff-created support tickets: keyed by the creating staff uid. 30 per 15 minutes covers a busy
// operator logging tickets on behalf of several customers in one sitting.
operationalRecordsRouter.post("/support-tickets", rateLimit("support-ticket-staff", { windowMs: 15 * 60_000, max: 30 }, uidKey), async (req: AuthenticatedRequest, res) => {
  try {
    const input = createSupportTicketSchema.parse(req.body);
    if (await requireRole(req, res, input.organizationId, allowed) === undefined) return;
    const [customer, project] = await Promise.all([db.doc(`organizations/${input.organizationId}/customers/${input.customerId}`).get(), input.projectId ? db.doc(`organizations/${input.organizationId}/projects/${input.projectId}`).get() : undefined]);
    if (!customer.exists || (input.projectId && (!project?.exists || project.data()?.customerId !== input.customerId))) return res.status(409).json({ error: { code: "INVALID_SUPPORT_SCOPE", message: "Customer and project must exist in the same account" } });
    const ref = db.collection(`organizations/${input.organizationId}/supportTickets`).doc(), now = new Date().toISOString();
    await ref.create({ id: ref.id, ...input, status: "open", responseDueAt: supportDueAt(input.priority, now), createdBy: req.user!.uid, createdAt: now, updatedAt: now });
    await audit(input.organizationId, "support.ticket.created", req.user!.uid, { ticketId: ref.id, customerId: input.customerId, projectId: input.projectId ?? null, priority: input.priority });
    return res.status(201).json({ data: { id: ref.id } });
  } catch (error) { return fail(res, error, "INVALID_SUPPORT_TICKET", "operational_records.support_ticket.staff_failed", "Invalid support ticket"); }
});

// Customer-portal ticket creation: the audit's flagged abuse vector — a portal user could script
// rapid-fire ticket creation. Keyed per portal uid; 10 per 15 minutes is well above what any real
// customer submits (one ticket per real issue) while stopping a scripted loop quickly.
operationalRecordsRouter.post("/projects/:projectId/support-tickets", rateLimit("support-ticket-portal", { windowMs: 15 * 60_000, max: 10 }, uidKey), async (req: AuthenticatedRequest, res) => {
  try {
    const input = z.object({ organizationId: z.string().min(1), subject: z.string().min(3).max(200), description: z.string().min(10).max(10_000), category: z.enum(["website_issue", "content", "domain", "billing", "maintenance", "other"]).default("other"), attachmentPaths: z.array(z.string().min(1).max(1000)).max(10).default([]), priority: z.enum(["critical", "high", "normal", "low"]).default("normal") }).parse(req.body), projectId = String(req.params.projectId);
    const member = await requireProjectAccess(req, res, input.organizationId, projectId); if (member === undefined) return;
    if (!customerPermission(member, "support")) return res.status(403).json({ error: { code: "SUPPORT_PERMISSION_REQUIRED", message: "Support access is disabled for this portal user" } });
    const project = await db.doc(`organizations/${input.organizationId}/projects/${projectId}`).get();
    if (!project.exists || !project.data()?.customerId) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    const ref = db.collection(`organizations/${input.organizationId}/supportTickets`).doc(), now = new Date().toISOString();
    const prefix = `organizations/${input.organizationId}/uploads/${req.user!.uid}/${projectId}/`;
    if (input.attachmentPaths.some(path => !path.startsWith(prefix))) return res.status(403).json({ error: { code: "INVALID_SUPPORT_ATTACHMENT", message: "Support attachments must belong to this user and project" } });
    await ref.create({ id: ref.id, ...input, projectId, customerId: project.data()!.customerId, status: "open", responseDueAt: supportDueAt(input.priority, now), source: "customer_portal", createdBy: req.user!.uid, createdAt: now, updatedAt: now });
    await db.collection(`organizations/${input.organizationId}/notifications`).add({ audience: "owner", customerId: project.data()!.customerId, projectId, ticketId: ref.id, title: "New customer support request", body: input.subject, params: { subject: input.subject, priority: input.priority }, severity: input.priority === "critical" ? "critical" : "warning", type: "support_ticket_created", read: false, createdAt: now });
    await audit(input.organizationId, "support.ticket.customer_created", req.user!.uid, { ticketId: ref.id, customerId: project.data()!.customerId, projectId, priority: input.priority });
    return res.status(201).json({ data: { id: ref.id, responseDueAt: supportDueAt(input.priority, now) } });
  } catch (error) { return fail(res, error, "INVALID_SUPPORT_TICKET", "operational_records.support_ticket.portal_failed", "Invalid support ticket"); }
});

operationalRecordsRouter.patch("/support-tickets/:ticketId", async (req: AuthenticatedRequest, res) => {
  try {
    const input = updateSupportTicketSchema.parse(req.body);
    if (await requirePlatformOrRole(req, res, input.organizationId, allowed) === undefined) return;
    const ref = db.doc(`organizations/${input.organizationId}/supportTickets/${String(req.params.ticketId)}`), ticket = await ref.get();
    if (!ticket.exists) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Support ticket not found" } });
    const now = new Date().toISOString(), terminal = ["resolved", "closed"].includes(input.status), note = input.internalNote ? ticket.ref.collection("internalNotes").doc() : undefined, batch = db.batch();
    batch.update(ref, { status: input.status, resolution: input.resolution ?? null, ...(input.priority ? { priority: input.priority } : {}), ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo || null } : {}), updatedBy: req.user!.uid, updatedAt: now, ...(terminal ? { resolvedAt: now, resolvedBy: req.user!.uid } : {}) });
    if (note) batch.create(note, { id: note.id, body: input.internalNote, createdBy: req.user!.uid, createdAt: now });
    if (terminal) { const notification = db.collection(`organizations/${input.organizationId}/notifications`).doc(); batch.create(notification, { audience: "customer", customerId: ticket.data()?.customerId, projectId: ticket.data()?.projectId, ticketId: ref.id, title: "Support request resolved", body: input.resolution, params: { resolution: input.resolution ?? "" }, type: "support_ticket_resolved", read: false, createdAt: now }); }
    await batch.commit();
    await audit(input.organizationId, "support.ticket.status_changed", req.user!.uid, { ticketId: ref.id, from: ticket.data()?.status, to: input.status, resolution: input.resolution ?? null });
    return res.json({ data: { id: ref.id, status: input.status } });
  } catch (error) { return fail(res, error, "INVALID_SUPPORT_UPDATE", "operational_records.support_ticket.update_failed", "Invalid support update"); }
});

operationalRecordsRouter.patch("/notifications/:notificationId/read", async (req: AuthenticatedRequest, res) => {
  const organizationId = z.string().min(1).parse(req.body.organizationId);
  if (await requireRole(req, res, organizationId, staffBroad) === undefined) return;
  const ref = db.doc(`organizations/${organizationId}/notifications/${String(req.params.notificationId)}`), notification = await ref.get();
  if (!notification.exists) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found" } });
  const now = new Date().toISOString(); await ref.update({ read: true, readAt: now, readBy: req.user!.uid });
  await audit(organizationId, "notification.acknowledged", req.user!.uid, { notificationId: ref.id });
  return res.json({ data: { id: ref.id, read: true } });
});

operationalRecordsRouter.patch("/notifications-read-all", async (req: AuthenticatedRequest, res) => {
  const organizationId = z.string().min(1).parse(req.body.organizationId);
  if (await requireRole(req, res, organizationId, staffBroad) === undefined) return;
  const unread = await db.collection(`organizations/${organizationId}/notifications`).where("read", "==", false).limit(500).get(), batch = db.batch(), now = new Date().toISOString();
  unread.docs.forEach(doc => batch.update(doc.ref, { read: true, readAt: now, readBy: req.user!.uid })); await batch.commit();
  await audit(organizationId, "notification.all_acknowledged", req.user!.uid, { count: unread.size });
  return res.json({ data: { count: unread.size } });
});

operationalRecordsRouter.put("/agent-settings/:agentId", async (req: AuthenticatedRequest, res) => {
  const input = z.object({ organizationId: z.string().min(1), maxConcurrentTasks: z.number().int().min(1).max(20), dailyBudgetUsd: z.number().min(0).max(10_000), preferredProvider: z.enum(["manual", "openai", "gemini"]), instructions: z.string().max(5000).default("") }).parse(req.body), agentId = agentIdSchema.parse(req.params.agentId);
  if (await requireRole(req, res, input.organizationId, ["owner"]) === undefined) return;
  const { organizationId, ...settings } = input, ref = db.doc(`organizations/${organizationId}/agentSettings/${agentId}`), previous = await ref.get(), now = new Date().toISOString();
  await ref.set({ id: agentId, ...settings, paused: previous.data()?.paused ?? false, version: Number(previous.data()?.version ?? 0) + 1, updatedAt: now, updatedBy: req.user!.uid }, { merge: true });
  await audit(organizationId, "agent.settings.updated", req.user!.uid, { agentId, previousVersion: previous.data()?.version ?? 0, settings });
  return res.json({ data: { id: agentId, version: Number(previous.data()?.version ?? 0) + 1 } });
});
