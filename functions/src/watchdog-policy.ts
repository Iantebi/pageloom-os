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

const FOLDER_DATE_PATTERN = /(\d{4}-\d{2}-\d{2})\/?$/;

// Firestore backup folder names sort correctly as plain strings since they're ISO dates
// (e.g. "firestore/2026-08-30/"), so the latest one is just the max after extraction.
export function latestBackupFolderDate(folderNames: string[]): Date | null {
  const dates = folderNames
    .map((name) => FOLDER_DATE_PATTERN.exec(name)?.[1])
    .filter((date): date is string => Boolean(date))
    .sort();
  const latest = dates.at(-1);
  return latest ? new Date(`${latest}T00:00:00Z`) : null;
}

const RELEVANT_SERVICE_HEALTH_RELEVANCE = new Set(["RELATED", "IMPACTED"]);

export function isRelevantActiveServiceHealthEvent(event: { state?: string; relevance?: string }): boolean {
  return event.state === "ACTIVE" && Boolean(event.relevance) && RELEVANT_SERVICE_HEALTH_RELEVANCE.has(event.relevance!);
}
