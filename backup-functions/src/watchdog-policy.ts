export const FIRESTORE_FRESHNESS_HOURS = 27;
export const STORAGE_FRESHNESS_HOURS = 204; // 8.5 days

export function hoursSince(now: Date, past: Date): number {
  return (now.getTime() - past.getTime()) / 3_600_000;
}

export function isFirestoreBackupStale(now: Date, latestBackupDate: Date): boolean {
  return hoursSince(now, latestBackupDate) > FIRESTORE_FRESHNESS_HOURS;
}

export function isStorageBackupStale(now: Date, lastSuccessTime: Date): boolean {
  return hoursSince(now, lastSuccessTime) > STORAGE_FRESHNESS_HOURS;
}

// Picks the most recent real timestamp out of a list of ISO datetime strings (e.g. GCS objects'
// timeCreated, or Storage Transfer operations' endTime). Deliberately NOT derived from parsing a
// "YYYY-MM-DD" folder/label name into midnight UTC - that anchor point can differ from the actual
// backup completion time by up to a day depending on timezone/DST, which previously caused a
// systematic ~23.5h overestimate of elapsed time and false "stale" alerts.
export function latestTimestamp(isoTimestamps: Array<string | undefined>): Date | null {
  const valid = isoTimestamps.filter((t): t is string => Boolean(t)).sort();
  const latest = valid.at(-1);
  return latest ? new Date(latest) : null;
}

const RELEVANT_SERVICE_HEALTH_RELEVANCE = new Set(["RELATED", "IMPACTED"]);

export function isRelevantActiveServiceHealthEvent(event: { state?: string; relevance?: string }): boolean {
  return event.state === "ACTIVE" && Boolean(event.relevance) && RELEVANT_SERVICE_HEALTH_RELEVANCE.has(event.relevance!);
}

// A GCS bucket holding 90 days of daily Firestore exports easily accumulates more objects than a
// single list page (each day's export writes an overall_export_metadata file plus multiple
// per-collection shard files) - Google's list APIs default to capping a single page around 1000
// items and only surface later items via nextPageToken. A watchdog that reads just the first page
// silently checks freshness against whatever objects happen to sort first, which - since GCS lists
// alphabetically by name and our export paths are "firestore/YYYY-MM-DD/..." - means the OLDEST
// backups once the bucket holds enough of them, permanently missing the actually-latest backup and
// risking a false "stale" alert (or worse, masking a real staleness by continuing to report an old
// backup as fresh forever). MAX_PAGES bounds worst-case memory/time if a misconfigured filter ever
// returns pages endlessly.
export const MAX_PAGINATION_PAGES = 50;

export async function collectAllPages<Item>(
  fetchPage: (pageToken: string | undefined) => Promise<{ items?: Item[] | undefined; nextPageToken?: string | undefined }>,
): Promise<Item[]> {
  const items: Item[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const page = await fetchPage(pageToken);
    items.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
    pages += 1;
  } while (pageToken && pages < MAX_PAGINATION_PAGES);
  return items;
}

// A Firestore managed export writes its per-collection output shards first and the top-level
// "<prefix>/<name>.overall_export_metadata" file LAST, only once the export operation completed.
// Freshness must be anchored to that completion marker: a newest-object timestamp alone also
// counts the shards of an export that started but then failed or was cut off half-way, which
// would make a partial/failed backup look fresh.
export const EXPORT_COMPLETE_SUFFIX = ".overall_export_metadata";

export function latestCompletedExport(items: Array<{ name?: string | undefined; timeCreated?: string | undefined }>): Date | null {
  return latestTimestamp(items.filter((item) => item.name?.endsWith(EXPORT_COMPLETE_SUFFIX)).map((item) => item.timeCreated));
}

// A non-2xx Google API response. Previously such responses were parsed as if they were a normal
// listing: a 403 (lost permission) or 404 (bucket gone) body simply has no `items`, which was then
// reported as "no backups found" at WARNING severity - and no alert policy fires on warnings, while
// the watchdog's own heartbeat kept arriving. Making the status explicit lets the caller fail closed.
export class HttpStatusError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

// Only network failures, timeouts, 429 and 5xx are worth retrying inside the same run; a 401/403/404
// will not fix itself seconds later and must surface immediately.
export function isTransientError(error: unknown): boolean {
  if (error instanceof HttpStatusError) return error.status === 429 || error.status >= 500;
  if (error instanceof Error) return error.name === "TypeError" || error.name === "AbortError" || error.name === "TimeoutError";
  return false;
}

// Back-off between in-run retries (2s, then 4s). Exported so tests can run with zero delay.
export const transientRetryDefaults = { attempts: 3, delayMs: 2_000 };

export async function withTransientRetry<T>(
  fn: () => Promise<T>,
  {
    attempts = transientRetryDefaults.attempts,
    delayMs = transientRetryDefaults.delayMs,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  }: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= attempts || !isTransientError(error)) throw error;
      await sleep(delayMs * attempt);
    }
  }
}
