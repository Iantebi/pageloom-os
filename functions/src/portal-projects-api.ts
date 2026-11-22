import { Router, type Response } from "express";
import { z } from "zod";
import { requireRole, type AuthenticatedRequest } from "./auth.js";
import { db } from "./firebase.js";

// Raw project documents contain financial and internal fields. Never spread them into a
// customer response. A stored id/organizationId cannot override trusted path identifiers.
export function portalProject(id: string, organizationId: string, data: Record<string, unknown>) {
  const fields = ["name", "clientName", "status", "journeyStage", "workflowStage", "workflowStatus", "locale", "customerApprovedAt", "updatedAt", "deadline"] as const;
  const result: Record<string, unknown> = { id, organizationId };
  for (const field of fields) if (typeof data[field] === "string") result[field] = data[field];
  result.progress = typeof data.progress === "number" && Number.isFinite(data.progress) ? Math.min(100, Math.max(0, data.progress)) : 0;
  if (data.blockedReason) result.blockedReason = "blocked";
  if (typeof data.websiteUrl === "string") {
    try { const url = new URL(data.websiteUrl); if (url.protocol === "https:" && !url.username && !url.password) result.websiteUrl = url.href; } catch { /* omit invalid URLs */ }
  }
  return result;
}

const identifier = z.string().min(1).max(128).regex(/^[^/]+$/);
export async function listPortalProjects(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: { code: "UNAUTHENTICATED" } });
  const parsed = identifier.safeParse(req.query.organizationId);
  if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_ORGANIZATION" } });
  const organizationId = parsed.data;
  const member = await requireRole(req, res, organizationId, ["owner", "admin", "operator", "member", "client"]);
  if (!member) return;
  const source = db.collection(`organizations/${organizationId}/projects`);
  let docs: FirebaseFirestore.DocumentSnapshot[];
  if (member.role === "client") {
    if (!identifier.safeParse(member.customerId).success) return res.status(403).json({ error: { code: "INVALID_CUSTOMER_SCOPE" } });
    // Malformed assignments fail closed rather than becoming unrestricted access.
    if (member.projectIds !== undefined && (!Array.isArray(member.projectIds) || member.projectIds.length > 100 || member.projectIds.some((id: unknown) => !identifier.safeParse(id).success))) {
      return res.status(403).json({ error: { code: "INVALID_PROJECT_SCOPE" } });
    }
    if (Array.isArray(member.projectIds) && member.projectIds.length > 0) {
      docs = await db.getAll(...[...new Set<string>(member.projectIds)].map(id => source.doc(id)));
    } else {
      docs = (await source.where("customerId", "==", member.customerId).orderBy("updatedAt", "desc").limit(100).get()).docs;
    }
    // Verify ownership even for server-maintained assignments: an old assignment must not
    // leak a project that has since moved to another customer.
    docs = docs.filter(doc => doc.exists && doc.data()?.customerId === member.customerId);
  } else {
    docs = (await source.orderBy("updatedAt", "desc").limit(100).get()).docs;
  }
  res.setHeader("Cache-Control", "no-store");
  return res.json({ data: docs.filter(doc => doc.exists).map(doc => portalProject(doc.id, organizationId, doc.data()!)) });
}

export const portalProjectsRouter = Router();
portalProjectsRouter.get("/portal/projects", listPortalProjects);
