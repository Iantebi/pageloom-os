#!/usr/bin/env node
/**
 * Read-only: finds the most recent SUCCESS operation of the weekly Storage Transfer job
 * that backs up customer media, and reports its freshness against the same 204h (8.5 day)
 * threshold the backupFreshnessWatchdog Cloud Function uses. Only ever calls
 * `gcloud transfer operations list` - never mutates anything, never touches production
 * buckets directly.
 *
 * Usage:
 *   node scripts/backup-verification/verify-storage-transfer.mjs \
 *     [--job transferJobs/13003081908546702248] [--project pageloom-os-production]
 *
 * Exit code is non-zero if the latest successful run is STALE or none was found.
 */
import { fileURLToPath } from "node:url";
import { listTransferOperationsCommand } from "./lib/gcloud-commands.mjs";
import { runJson } from "./lib/exec.mjs";
import { summarizeFreshness, isStorageBackupStale, STORAGE_FRESHNESS_HOURS } from "./lib/freshness.mjs";
import { PRODUCTION_PROJECT_ID } from "./lib/project-guard.mjs";

function parseArgs(argv) {
  const flag = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
  return {
    job: flag("--job", "transferJobs/13003081908546702248"),
    project: flag("--project", PRODUCTION_PROJECT_ID),
  };
}

export function summarizeTransferOperations(operations, now = new Date()) {
  const successTimes = (operations ?? [])
    .map((op) => op.metadata)
    .filter((metadata) => metadata?.status === "SUCCESS" && Boolean(metadata.endTime))
    .map((metadata) => metadata.endTime)
    .sort();
  const latest = successTimes.length ? new Date(successTimes.at(-1)) : null;
  return {
    operationCount: (operations ?? []).length,
    successCount: successTimes.length,
    ...summarizeFreshness({ label: "storage-transfer", now, latest, staleCheck: isStorageBackupStale, thresholdHours: STORAGE_FRESHNESS_HOURS }),
  };
}

function main() {
  const { job, project } = parseArgs(process.argv.slice(2));
  const result = runJson(listTransferOperationsCommand(job, project));
  const operations = Array.isArray(result) ? result : result?.operations;
  const summary = { job, project, ...summarizeTransferOperations(operations) };
  console.log(JSON.stringify(summary, null, 2));
  if (summary.status === "STALE" || summary.status === "unknown") process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
