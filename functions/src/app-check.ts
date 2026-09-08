import type { NextFunction, Request, Response } from "express";
import { getAppCheck } from "firebase-admin/app-check";
import { operationalLog, safeErrorName } from "./observability.js";

export interface AppCheckRequest extends Request { appCheck?: { verified: boolean } }

// Monitoring-only, by design: this middleware never rejects a request, regardless of whether an
// App Check token is present or valid. Firebase App Check enforcement is a per-product toggle
// (Firestore/Storage/this Functions endpoint) made in the Firebase Console, and the staged rollout
// plan (docs/mfa-app-check/ROLLOUT.md) is to watch real traffic in the Console's App Check metrics
// tab across every client surface first. Rejecting requests here would pre-empt that staged
// rollout in code and risks locking out real users (e.g. an unenrolled native client, or App Check
// misconfigured for one environment) before an operator ever decided to enforce anything.
export async function monitorAppCheck(req: AppCheckRequest, _res: Response, next: NextFunction) {
  const token = req.headers["x-firebase-appcheck"];
  if (typeof token !== "string" || !token) {
    operationalLog("warning", "app_check.token_missing", {});
    req.appCheck = { verified: false };
    return next();
  }
  try {
    await getAppCheck().verifyToken(token);
    operationalLog("info", "app_check.token_valid", {});
    req.appCheck = { verified: true };
  } catch (error) {
    operationalLog("warning", "app_check.token_invalid", { errorType: safeErrorName(error) });
    req.appCheck = { verified: false };
  }
  return next();
}
