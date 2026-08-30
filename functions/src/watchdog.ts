import { params } from "./config.js";
import { db } from "./firebase.js";
import { operationalLog, safeErrorName } from "./observability.js";
import { isFirestoreBackupStale, isStorageBackupStale, isRelevantActiveServiceHealthEvent, latestBackupFolderDate } from "./watchdog-policy.js";

// Cloud Logging alone is not actionable for an owner who isn't watching logs, so every warning or
// error signal below is also persisted here for the /platform/system-health endpoint to surface -
// the same "never report a false success, never fail silently" rule the backup job already follows.
async function recordAlert(type: string, severity: "warning" | "error", detail: Record<string, string | number | boolean | undefined> = {}): Promise<void> {
  try {
    const ref = db.collection("systemOperations/watchdog/alerts").doc();
    await ref.set({ id: ref.id, type, severity, ...detail, createdAt: new Date().toISOString() });
  } catch (error) {
    // Alerting must never become a new failure point: a Firestore hiccup here should not stop the
    // remaining checks or the heartbeat write from running, so it is logged and swallowed here
    // rather than left to propagate out of whichever check called this.
    operationalLog("warning", "watchdog.alert_write_failed", { type, reason: safeErrorName(error) });
  }
}

async function accessToken(): Promise<string> {
  const { google } = await import("googleapis");
  const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const token = await auth.getAccessToken();
  if (!token) throw new Error("Unable to acquire a Google access token for the backup watchdog");
  return token;
}

async function checkFirestoreFreshness(now: Date): Promise<void> {
  try {
    const bucket = params.backupBucket.value();
    const token = await accessToken();
    const response = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o?delimiter=/&prefix=firestore/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = (await response.json()) as { prefixes?: string[] };
    const latest = latestBackupFolderDate(result.prefixes ?? []);
    if (!latest) {
      operationalLog("warning", "watchdog.check_failed", { check: "firestore", reason: "no_backup_folders_found" });
      await recordAlert("firestore_check_failed", "warning", { reason: "no_backup_folders_found" });
      return;
    }
    if (isFirestoreBackupStale(now, latest)) {
      const hoursSinceLastBackup = Math.round((now.getTime() - latest.getTime()) / 3_600_000);
      operationalLog("error", "watchdog.firestore_backup_stale", { latestBackupDate: latest.toISOString(), hoursSinceLastBackup });
      await recordAlert("firestore_backup_stale", "error", { latestBackupDate: latest.toISOString(), hoursSinceLastBackup });
    }
  } catch (error) {
    operationalLog("warning", "watchdog.check_failed", { check: "firestore", reason: safeErrorName(error) });
    await recordAlert("firestore_check_failed", "warning", { reason: safeErrorName(error) });
  }
}

async function checkStorageFreshness(now: Date): Promise<void> {
  try {
    const jobName = params.mediaBackupTransferJobName.value();
    const projectId = params.gcpDeployProject.value();
    const token = await accessToken();
    const filter = encodeURIComponent(JSON.stringify({ projectId, jobNames: [jobName] }));
    const response = await fetch(`https://storagetransfer.googleapis.com/v1/transferOperations?filter=${filter}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = (await response.json()) as { operations?: Array<{ metadata?: { status?: string; endTime?: string } }> };
    const successEndTimes = (result.operations ?? [])
      .map((op) => op.metadata)
      .filter((metadata): metadata is { status?: string; endTime?: string } => metadata?.status === "SUCCESS" && Boolean(metadata.endTime))
      .map((metadata) => metadata.endTime as string)
      .sort();
    const latestEnd = successEndTimes.at(-1);
    if (!latestEnd) {
      operationalLog("warning", "watchdog.check_failed", { check: "storage", reason: "no_successful_operations_found" });
      await recordAlert("storage_check_failed", "warning", { reason: "no_successful_operations_found" });
      return;
    }
    const latestDate = new Date(latestEnd);
    if (isStorageBackupStale(now, latestDate)) {
      const hoursSinceLastSuccess = Math.round((now.getTime() - latestDate.getTime()) / 3_600_000);
      operationalLog("error", "watchdog.storage_backup_stale", { lastSuccessTime: latestDate.toISOString(), hoursSinceLastSuccess });
      await recordAlert("storage_backup_stale", "error", { lastSuccessTime: latestDate.toISOString(), hoursSinceLastSuccess });
    }
  } catch (error) {
    operationalLog("warning", "watchdog.check_failed", { check: "storage", reason: safeErrorName(error) });
    await recordAlert("storage_check_failed", "warning", { reason: safeErrorName(error) });
  }
}

async function checkServiceHealth(): Promise<void> {
  try {
    const projectId = params.gcpDeployProject.value();
    const token = await accessToken();
    // Personalized Service Health only exposes a "global" location at the project level - there is
    // no per-region events collection, confirmed via locations.list returning exactly one location.
    const response = await fetch(`https://servicehealth.googleapis.com/v1/projects/${projectId}/locations/global/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 403 || response.status === 404) return; // API not enabled - not a failure, just not configured
    const result = (await response.json()) as { events?: Array<{ title?: string; state?: string; relevance?: string }> };
    const relevant = (result.events ?? []).filter(isRelevantActiveServiceHealthEvent);
    if (relevant.length > 0) {
      const titles = relevant.map((event) => event.title).filter(Boolean).join("; ").slice(0, 400);
      operationalLog("error", "watchdog.service_health_incident", { count: relevant.length, titles });
      await recordAlert("service_health_incident", "error", { count: relevant.length, titles });
    }
  } catch (error) {
    operationalLog("warning", "watchdog.check_failed", { check: "serviceHealth", reason: safeErrorName(error) });
    await recordAlert("service_health_check_failed", "warning", { reason: safeErrorName(error) });
  }
}

export async function runBackupFreshnessWatchdog(): Promise<void> {
  const now = new Date();
  await checkFirestoreFreshness(now);
  await checkStorageFreshness(now);
  await checkServiceHealth();
  operationalLog("info", "watchdog.heartbeat", { checkedAt: now.toISOString() });
  // Persisted separately from the per-check alerts above so a stuck/broken schedule (the case Cloud
  // Logging alone would never surface to an owner who isn't tailing logs) is itself detectable: a
  // stale heartbeat here means the watchdog stopped running, not that everything is healthy.
  try {
    await db.doc("systemOperations/watchdogHeartbeat").set({ checkedAt: now.toISOString() });
  } catch (error) {
    operationalLog("warning", "watchdog.heartbeat_write_failed", { reason: safeErrorName(error) });
  }
}
