import { Router, type Response } from "express";
import { z } from "zod";
import { requireRole, type AuthenticatedRequest } from "./auth.js";
import { db } from "./firebase.js";
import { invitationExpiresAt, normalizeInvitationEmail } from "./customer-invitations.js";
import { createHash } from "node:crypto";

// Staff (owner/admin/operator/member) invitations and role management. Mirrors
// customer-invitations.ts but for internal team access rather than portal access.
// Role escalation is deliberately restricted: only an existing Owner may grant or
// change Owner/Admin access, and nobody may disable or demote their own account.

export const staffAdminRouter = Router();
const org = z.string().min(1);
const staffRoles = ["owner", "admin", "operator", "member"] as const;
const elevated = new Set(["owner", "admin"]);

function staffInvitationId(organizationId: string, email: string) {
  return createHash("sha256").update(`${organizationId}:${email}`).digest("hex");
}

staffAdminRouter.post("/staff/invite", async (req: AuthenticatedRequest, res) => {
  try {
    const input = z.object({ organizationId: org, email: z.string().email(), role: z.enum(staffRoles) }).parse(req.body);
    const actor = await requireRole(req, res, input.organizationId, ["owner", "admin"]); if (actor === undefined) return;
    if (elevated.has(input.role) && actor.role !== "owner") return res.status(403).json({ error: { code: "ESCALATION_DENIED", message: "Only an Owner can grant Owner or Admin access" } });
    const email = normalizeInvitationEmail(input.email), id = staffInvitationId(input.organizationId, email), now = new Date().toISOString();
    const existingMember = await db.collection(`organizations/${input.organizationId}/members`).where("email", "==", email).limit(1).get();
    if (!existingMember.empty) return res.status(409).json({ error: { code: "ALREADY_A_MEMBER", message: "This email already has organization access" } });
    await db.doc(`organizations/${input.organizationId}/staffInvitations/${id}`).set({ id, organizationId: input.organizationId, email, role: input.role, status: "pending", createdBy: req.user!.uid, createdAt: now, updatedAt: now, expiresAt: invitationExpiresAt() }, { merge: true });
    await db.collection(`organizations/${input.organizationId}/activity`).add({ type: "staff.invited", actorId: req.user!.uid, email, role: input.role, createdAt: now });
    return res.status(201).json({ data: { id, email, role: input.role, status: "pending" } });
  } catch (error) { return fail(error, res); }
});

staffAdminRouter.patch("/staff/:uid", async (req: AuthenticatedRequest, res) => {
  try {
    const input = z.object({ organizationId: org, role: z.enum(staffRoles).optional(), disabled: z.boolean().optional() }).refine(value => value.role !== undefined || value.disabled !== undefined, { message: "Provide a role or disabled change" }).parse(req.body), uid = String(req.params.uid);
    const actor = await requireRole(req, res, input.organizationId, ["owner", "admin"]); if (actor === undefined) return;
    const ref = db.doc(`organizations/${input.organizationId}/members/${uid}`), member = await ref.get();
    if (!member.exists || member.data()?.role === "client") return res.status(404).json({ error: { code: "STAFF_MEMBER_NOT_FOUND", message: "Staff member not found" } });
    const currentRole = String(member.data()?.role);
    if ((elevated.has(currentRole) || (input.role && elevated.has(input.role))) && actor.role !== "owner") return res.status(403).json({ error: { code: "ESCALATION_DENIED", message: "Only an Owner can change Owner or Admin access" } });
    if (uid === req.user!.uid && (input.disabled === true || (input.role && input.role !== currentRole))) return res.status(409).json({ error: { code: "SELF_CHANGE_DENIED", message: "You cannot change your own role or disable your own account" } });
    const now = new Date().toISOString();
    await ref.update({ ...(input.role ? { role: input.role } : {}), ...(input.disabled !== undefined ? { disabled: input.disabled } : {}), updatedBy: req.user!.uid, updatedAt: now });
    await db.collection(`organizations/${input.organizationId}/activity`).add({ type: "staff.member_updated", actorId: req.user!.uid, targetUid: uid, role: input.role ?? currentRole, disabled: input.disabled ?? member.data()?.disabled ?? false, createdAt: now });
    return res.json({ data: { uid, role: input.role ?? currentRole, disabled: input.disabled ?? member.data()?.disabled ?? false } });
  } catch (error) { return fail(error, res); }
});

/** Claims any pending staff invitation for a verified sign-in, granting org access with the invited role. */
export async function claimStaffInvitations(identity: { uid: string; email?: string; emailVerified: boolean }) {
  if (!identity.email || !identity.emailVerified) return 0;
  const email = normalizeInvitationEmail(identity.email), now = new Date();
  const pending = await db.collectionGroup("staffInvitations").where("email", "==", email).limit(20).get();
  let accepted = 0;
  for (const invitation of pending.docs) {
    if (invitation.data().status !== "pending" || new Date(String(invitation.data().expiresAt)).getTime() <= now.getTime()) continue;
    const organization = invitation.ref.parent.parent;
    if (!organization) continue;
    await db.runTransaction(async transaction => {
      const current = await transaction.get(invitation.ref);
      if (!current.exists || current.data()?.status !== "pending" || new Date(String(current.data()?.expiresAt)).getTime() <= now.getTime()) return;
      const role = String(current.data()?.role ?? "member");
      transaction.set(organization.collection("members").doc(identity.uid), { uid: identity.uid, email, role, disabled: false, invitationId: invitation.id, joinedAt: now.toISOString(), updatedAt: now.toISOString() }, { merge: true });
      transaction.update(invitation.ref, { status: "accepted", acceptedBy: identity.uid, acceptedAt: now.toISOString(), updatedAt: now.toISOString() });
      accepted++;
    });
  }
  return accepted;
}

function fail(error: unknown, res: Response) {
  if (error instanceof z.ZodError) return res.status(422).json({ error: { code: "VALIDATION_ERROR", message: error.issues.map(issue => issue.message).join(", ") } });
  return res.status(400).json({ error: { code: "STAFF_ADMIN_ERROR", message: error instanceof Error ? error.message : "Staff admin operation failed" } });
}
