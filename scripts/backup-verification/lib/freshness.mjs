/**
 * Freshness thresholds and evaluation, mirroring functions/src/watchdog-policy.ts. Kept as
 * a standalone copy (not imported from functions/lib) so these scripts run with plain
 * `node`, independent of the functions workspace's TypeScript build. If either threshold
 * changes, update both files.
 */
export const FIRESTORE_FRESHNESS_HOURS = 27;
export const STORAGE_FRESHNESS_HOURS = 204; // 8.5 days

export function hoursSince(now, past) {
  return (now.getTime() - past.getTime()) / 3_600_000;
}

export function isFirestoreBackupStale(now, latestBackupDate) {
  return hoursSince(now, latestBackupDate) > FIRESTORE_FRESHNESS_HOURS;
}

export function isStorageBackupStale(now, lastSuccessTime) {
  return hoursSince(now, lastSuccessTime) > STORAGE_FRESHNESS_HOURS;
}

// Picks the most recent real timestamp out of a list of ISO datetime strings - deliberately
// not derived from parsing a "YYYY-MM-DD" folder/label name into midnight UTC (see
// functions/src/watchdog-policy.ts's latestTimestamp for the timezone bug that caused).
export function latestTimestamp(isoTimestamps) {
  const valid = (isoTimestamps ?? []).filter((t) => Boolean(t)).sort();
  const latest = valid.at(-1);
  return latest ? new Date(latest) : null;
}

export function summarizeFreshness({ label, now, latest, staleCheck, thresholdHours }) {
  if (!latest) {
    return { label, status: "unknown", detail: "No backup objects/operations found." };
  }
  const hours = hoursSince(now, latest);
  return {
    label,
    status: staleCheck(now, latest) ? "STALE" : "fresh",
    latest: latest.toISOString(),
    hoursSinceLatest: Math.round(hours * 10) / 10,
    thresholdHours,
  };
}
