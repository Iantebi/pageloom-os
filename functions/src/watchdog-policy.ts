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
  fetchPage: (pageToken: string | undefined) => Promise<{ items?: Item[]; nextPageToken?: string }>,
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
