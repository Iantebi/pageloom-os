import { db } from "./firebase.js";
import { params } from "./config.js";
import { operationalLog, safeErrorName } from "./observability.js";
import { backupPrefix, firestoreExportUrl } from "./backup-policy.js";

// Starting an export is a single fast API call (the export itself runs asynchronously in Firestore);
// the timeout only stops a hung connection from holding the function until its 540s limit.
const EXPORT_REQUEST_TIMEOUT_MS = 60_000;

export async function exportFirestoreBackup(): Promise<void> {
  const projectId = params.gcpDeployProject.value();
  const bucket = params.backupBucket.value();
  const runId = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const run = db.doc(`systemOperations/backups/runs/${runId}`);
  if (!bucket) {
    await run.set({ id: runId, status: "configuration_required", reason: "PAGELOOM_BACKUP_BUCKET is not configured", createdAt: new Date().toISOString() });
    operationalLog("error", "backup.configuration_required", { projectId });
    return;
  }
  const outputUriPrefix = backupPrefix(bucket);
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/datastore", "https://www.googleapis.com/auth/cloud-platform"] });
  const token = await auth.getAccessToken();
  if (!token) throw new Error("Unable to acquire a Google access token for backup");
  const startedAt = new Date().toISOString();
  let response: Response;
  try {
    response = await fetch(firestoreExportUrl(projectId), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ outputUriPrefix }),
      signal: AbortSignal.timeout(EXPORT_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // Network failure or timeout: record it (so the run history shows why) and throw so Cloud
    // Scheduler retries and the scheduler-failure alerts fire.
    const reason = `Firestore export request failed: ${safeErrorName(error)}`;
    await run.set({ id: runId, status: "failed", reason, outputUriPrefix, startedAt, updatedAt: new Date().toISOString() });
    throw new Error(reason);
  }
  // A non-JSON body (e.g. an HTML error page from a proxy) must not crash before the failure is
  // recorded: treat it as an empty result, which falls through to the HTTP-status failure below.
  const result = await response.json().catch(() => ({})) as { name?: string; error?: { message?: string } };
  if (!response.ok || !result.name) {
    const reason = result.error?.message ?? `Firestore export returned HTTP ${response.status}`;
    // Cloud Scheduler retries this job aggressively on any non-2xx response; if an earlier attempt
    // already completed today's export before a retry lands, Firestore correctly rejects the
    // duplicate with this exact message. That's not a failure - today's backup already exists -
    // so it's recorded and logged as such instead of a thrown error, which otherwise showed up as
    // a noisy, misleading "backup failed" entry for a day that was actually backed up successfully.
    if (/path already exists/i.test(reason)) {
      await run.set({ id: runId, status: "already_completed", reason, outputUriPrefix, startedAt, updatedAt: new Date().toISOString() });
      operationalLog("info", "backup.already_completed", { projectId, outputUriPrefix });
      return;
    }
    await run.set({ id: runId, status: "failed", reason, outputUriPrefix, startedAt, updatedAt: new Date().toISOString() });
    throw new Error(reason);
  }
  await run.set({ id: runId, status: "started", operationName: result.name, outputUriPrefix, startedAt, updatedAt: new Date().toISOString() });
  operationalLog("info", "backup.started", { projectId, operationName: result.name, outputUriPrefix });
}
