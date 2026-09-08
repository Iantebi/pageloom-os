#!/usr/bin/env node
/**
 * Read-only: finds the latest Firestore export object in the production backup bucket and
 * reports its freshness against the same 27h threshold the backupFreshnessWatchdog Cloud
 * Function uses. Only ever calls `gcloud storage objects list` - never mutates anything.
 *
 * Usage:
 *   node scripts/backup-verification/verify-firestore-backup.mjs [--bucket <bucket>]
 *
 * Exit code is non-zero if the latest export is STALE or no export objects were found, so
 * this can be used directly in a cron/CI freshness check.
 */
import { fileURLToPath } from "node:url";
import { listFirestoreExportObjectsCommand } from "./lib/gcloud-commands.mjs";
import { runJson } from "./lib/exec.mjs";
import { latestTimestamp, summarizeFreshness, isFirestoreBackupStale, FIRESTORE_FRESHNESS_HOURS } from "./lib/freshness.mjs";

function parseArgs(argv) {
  const flag = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
  return { bucket: flag("--bucket", "pageloom-os-production-backups") };
}

export function summarizeFirestoreExports(objects, now = new Date()) {
  const timestamps = (objects ?? []).map((o) => o.timeCreated ?? o.updateTime);
  const latest = latestTimestamp(timestamps);
  return {
    objectCount: (objects ?? []).length,
    ...summarizeFreshness({ label: "firestore-export", now, latest, staleCheck: isFirestoreBackupStale, thresholdHours: FIRESTORE_FRESHNESS_HOURS }),
  };
}

function main() {
  const { bucket } = parseArgs(process.argv.slice(2));
  const objects = runJson(listFirestoreExportObjectsCommand(bucket));
  const summary = { bucket, ...summarizeFirestoreExports(objects) };
  console.log(JSON.stringify(summary, null, 2));
  if (summary.status === "STALE" || summary.status === "unknown") process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
