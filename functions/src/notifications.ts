import { Router } from "express";
import { z } from "zod";
import { db } from "./firebase.js";
import { operationalLog } from "./observability.js";
import { requireRole, type AuthenticatedRequest } from "./auth.js";

export type NotificationAudience = "owner" | "customer";

export type NotificationDoc = {
  audience: NotificationAudience;
  type: string;
  title: string;
  body: string;
  projectId?: string;
  customerId?: string | null;
  params?: Record<string, unknown>;
};

// Single write path for every in-app notification (Owner-facing or customer-facing) across the
// whole API — discovery-api.ts and api.ts's project-comments handler both call this instead of
// writing to the `notifications` collection directly. That matters for one reason: it's the one
// seam a future Firebase Cloud Messaging push send plugs into, so enabling real push later means
// adding a branch here, not touching every call site that currently fires a notification.
//
// FUTURE (push not yet configured — see docs/ARCHITECTURE.md's 2026-09-18 amendment for the full
// list): once a VAPID key exists and apps/web registers firebase-messaging-sw.js, this would become:
//   const tokens = await fcmTokensFor(organizationId, doc.audience, doc.customerId);
//   if (tokens.length) await getMessaging().sendEachForMulticast({ tokens, notification: { title: doc.title, body: doc.body } });
// fcmTokensFor() would read the organizations/{orgId}/fcmTokens collection this file's sibling
// endpoints (see staff-admin-api.ts's /notifications/fcm-token) already populate.
export async function notify(organizationId: string, doc: NotificationDoc) {
  const ref = db.collection(`organizations/${organizationId}/notifications`).doc();
  const record = { id: ref.id, read: false, createdAt: new Date().toISOString(), ...doc };
  await ref.set(record);
  operationalLog("info", "notification.created", { organizationId, notificationId: ref.id, type: doc.type, audience: doc.audience });
  return record;
}

const anyMember = ["owner", "admin", "operator", "member", "client"];

// FCM push infrastructure — registers/unregisters a browser's push token so notify() above can
// send real push once the remaining external setup (see the top-of-file FUTURE comment) is done.
// Nothing currently reads this collection; adding that read is the entire remaining work once a
// VAPID key exists. Any signed-in org member may register their own device — there is no
// staff/client role split here, since every audience the notify() call sites use (owner, customer)
// eventually needs its own tokens stored the same way.
export const pushTokensRouter = Router();
const org = z.string().min(1);

pushTokensRouter.post("/notifications/fcm-token", async (req: AuthenticatedRequest, res) => {
  try {
    const input = z.object({ organizationId: org, token: z.string().min(1).max(4096), platform: z.enum(["web", "android", "ios", "windows"]).default("web") }).parse(req.body);
    const member = await requireRole(req, res, input.organizationId, anyMember); if (member === undefined) return;
    await db.doc(`organizations/${input.organizationId}/fcmTokens/${encodeURIComponent(input.token)}`).set({
      token: input.token, uid: req.user!.uid, role: member.role, customerId: member.customerId ?? null,
      platform: input.platform, updatedAt: new Date().toISOString(),
    }, { merge: true });
    return res.status(201).json({ data: { registered: true } });
  } catch (error) { return res.status(400).json({ error: { code: "FCM_TOKEN_REGISTER_FAILED", message: error instanceof Error ? error.message : "Could not register push token" } }); }
});

pushTokensRouter.delete("/notifications/fcm-token", async (req: AuthenticatedRequest, res) => {
  try {
    const input = z.object({ organizationId: org, token: z.string().min(1).max(4096) }).parse(req.body);
    if (await requireRole(req, res, input.organizationId, anyMember) === undefined) return;
    await db.doc(`organizations/${input.organizationId}/fcmTokens/${encodeURIComponent(input.token)}`).delete();
    return res.json({ data: { registered: false } });
  } catch (error) { return res.status(400).json({ error: { code: "FCM_TOKEN_UNREGISTER_FAILED", message: error instanceof Error ? error.message : "Could not remove push token" } }); }
});
