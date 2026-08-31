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
