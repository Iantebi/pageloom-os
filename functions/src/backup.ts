import { db } from "./firebase.js";
import { params } from "./config.js";
import { operationalLog } from "./observability.js";
import { backupPrefix, firestoreExportUrl } from "./backup-policy.js";

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
  const { google } = await import("googleapis");
  const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/datastore", "https://www.googleapis.com/auth/cloud-platform"] });
  const token = await auth.getAccessToken();
  if (!token) throw new Error("Unable to acquire a Google access token for backup");
  const startedAt = new Date().toISOString();
  const response = await fetch(firestoreExportUrl(projectId), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ outputUriPrefix }),
  });
  const result = await response.json() as { name?: string; error?: { message?: string } };
  if (!response.ok || !result.name) {
    const reason = result.error?.message ?? `Firestore export returned HTTP ${response.status}`;
    await run.set({ id: runId, status: "failed", reason, outputUriPrefix, startedAt, updatedAt: new Date().toISOString() });
    throw new Error(reason);
  }
  await run.set({ id: runId, status: "started", operationName: result.name, outputUriPrefix, startedAt, updatedAt: new Date().toISOString() });
  operationalLog("info", "backup.started", { projectId, operationName: result.name, outputUriPrefix });
}
