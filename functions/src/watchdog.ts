import { params } from "./config.js";
import { operationalLog, safeErrorName } from "./observability.js";
import { isFirestoreBackupStale, isStorageBackupStale, isRelevantActiveServiceHealthEvent, latestBackupFolderDate } from "./watchdog-policy.js";

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
      return;
    }
    if (isFirestoreBackupStale(now, latest)) {
      operationalLog("error", "watchdog.firestore_backup_stale", {
        latestBackupDate: latest.toISOString(),
        hoursSinceLastBackup: Math.round((now.getTime() - latest.getTime()) / 3_600_000),
      });
    }
  } catch (error) {
    operationalLog("warning", "watchdog.check_failed", { check: "firestore", reason: safeErrorName(error) });
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
      return;
    }
    const latestDate = new Date(latestEnd);
    if (isStorageBackupStale(now, latestDate)) {
      operationalLog("error", "watchdog.storage_backup_stale", {
        lastSuccessTime: latestDate.toISOString(),
        hoursSinceLastSuccess: Math.round((now.getTime() - latestDate.getTime()) / 3_600_000),
      });
    }
  } catch (error) {
    operationalLog("warning", "watchdog.check_failed", { check: "storage", reason: safeErrorName(error) });
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
      operationalLog("error", "watchdog.service_health_incident", {
        count: relevant.length,
        titles: relevant.map((event) => event.title).filter(Boolean).join("; ").slice(0, 400),
      });
    }
  } catch (error) {
    operationalLog("warning", "watchdog.check_failed", { check: "serviceHealth", reason: safeErrorName(error) });
  }
}

export async function runBackupFreshnessWatchdog(): Promise<void> {
  const now = new Date();
  await checkFirestoreFreshness(now);
  await checkStorageFreshness(now);
  await checkServiceHealth();
  operationalLog("info", "watchdog.heartbeat", { checkedAt: now.toISOString() });
}
