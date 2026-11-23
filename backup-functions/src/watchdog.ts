import { params } from "./config.js";
import { operationalLog, safeErrorName } from "./observability.js";
import { isFirestoreBackupStale, isStorageBackupStale, isRelevantActiveServiceHealthEvent, latestCompletedExport, collectAllPages, HttpStatusError, withTransientRetry } from "./watchdog-policy.js";

// Every Google API read goes through here: non-2xx is an error (never parsed as an empty listing),
// each request has a hard timeout so one hung call cannot eat the whole run, and only transient
// failures (network, timeout, 429, 5xx) are retried within the run.
const REQUEST_TIMEOUT_MS = 30_000;
async function getJson<T>(url: string | URL, token: string): Promise<T> {
  return withTransientRetry(async () => {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw new HttpStatusError(response.status);
    return (await response.json()) as T;
  });
}

// When freshness cannot be PROVEN (permission lost, bucket missing, API failing after retries, or
// no completed export at all) the watchdog fails closed: it reports the backup as stale at ERROR, so
// the existing P10 alert (pageloom_watchdog_backup_stale) fires. Before, these cases were WARNINGs
// that no alert policy watched - a silent gap, since the heartbeat kept arriving. The `reason`
// field separates "proven old" from "could not verify" for diagnosis; neither carries secrets.
function unverifiable(event: "watchdog.firestore_backup_stale" | "watchdog.storage_backup_stale", reason: string, error?: unknown): void {
  operationalLog("error", event, {
    reason,
    errorName: error === undefined ? undefined : safeErrorName(error),
    httpStatus: error instanceof HttpStatusError ? error.status : undefined,
  });
}

async function accessToken(): Promise<string> {
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const token = await auth.getAccessToken();
  if (!token) throw new Error("Unable to acquire a Google access token for the backup watchdog");
  return token;
}

async function checkFirestoreFreshness(now: Date): Promise<void> {
  try {
    const bucket = params.backupBucket.value();
    const token = await accessToken();
    // Use each object's real timeCreated rather than parsing the "firestore/YYYY-MM-DD/" folder
    // name into a date: the export runs at 02:30 Asia/Jerusalem, which is 23:30 UTC the PREVIOUS
    // day during Israeli Daylight Time - so the folder's date and the run's actual wall-clock
    // completion time can differ by up to a day. Anchoring to the folder name's midnight UTC
    // previously overestimated elapsed time by ~23.5h and produced false "stale" alerts.
    //
    // Paginated: 90 days of daily exports (each writing several objects) can exceed a single GCS
    // list page. `fields` must explicitly request nextPageToken - the partial-response filter drops
    // it otherwise - or a full bucket silently truncates to its oldest objects (GCS lists
    // alphabetically, and "firestore/YYYY-MM-DD/" sorts oldest-first) and the most recent backup is
    // never seen. See watchdog-policy.ts's collectAllPages for the pagination cap.
    const items = await collectAllPages<{ name?: string; timeCreated?: string }>(async (pageToken) => {
      const url = new URL(`https://storage.googleapis.com/storage/v1/b/${bucket}/o`);
      url.searchParams.set("prefix", "firestore/");
      url.searchParams.set("fields", "nextPageToken,items(name,timeCreated)");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      return getJson<{ items?: Array<{ name?: string; timeCreated?: string }>; nextPageToken?: string }>(url, token);
    });
    // Only a completed export counts (see EXPORT_COMPLETE_SUFFIX): shards of a failed or partial
    // export must not make the backup look fresh.
    const latest = latestCompletedExport(items);
    if (!latest) {
      unverifiable("watchdog.firestore_backup_stale", items.length ? "no_completed_export_found" : "no_backup_objects_found");
      return;
    }
    if (isFirestoreBackupStale(now, latest)) {
      operationalLog("error", "watchdog.firestore_backup_stale", {
        latestBackupDate: latest.toISOString(),
        hoursSinceLastBackup: Math.round((now.getTime() - latest.getTime()) / 3_600_000),
      });
    }
  } catch (error) {
    unverifiable("watchdog.firestore_backup_stale", "check_failed", error);
  }
}

async function checkStorageFreshness(now: Date): Promise<void> {
  try {
    const jobName = params.mediaBackupTransferJobName.value();
    const projectId = params.gcpDeployProject.value();
    const token = await accessToken();
    const filter = encodeURIComponent(JSON.stringify({ projectId, jobNames: [jobName] }));
    const operations = await collectAllPages<{ metadata?: { status?: string; endTime?: string } }>(async (pageToken) => {
      const url = `https://storagetransfer.googleapis.com/v1/transferOperations?filter=${filter}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
      const result = await getJson<{ operations?: Array<{ metadata?: { status?: string; endTime?: string } }>; nextPageToken?: string }>(url, token);
      return { items: result.operations, nextPageToken: result.nextPageToken };
    });
    const successEndTimes = operations
      .map((op) => op.metadata)
      .filter((metadata): metadata is { status?: string; endTime?: string } => metadata?.status === "SUCCESS" && Boolean(metadata.endTime))
      .map((metadata) => metadata.endTime as string)
      .sort();
    const latestEnd = successEndTimes.at(-1);
    if (!latestEnd) {
      unverifiable("watchdog.storage_backup_stale", "no_successful_operations_found");
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
    unverifiable("watchdog.storage_backup_stale", "check_failed", error);
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
