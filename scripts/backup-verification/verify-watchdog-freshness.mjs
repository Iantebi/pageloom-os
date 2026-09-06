#!/usr/bin/env node
/**
 * Read-only: fetches recent backupFreshnessWatchdog Cloud Function logs and reports whether
 * a heartbeat has been seen recently, and whether any stale/error/check-failed events were
 * logged. Only ever calls `gcloud functions logs read` - never mutates anything.
 *
 * The watchdog itself (functions/src/watchdog.ts) already alerts on real staleness; this
 * script is for a human (or CI) to independently confirm the watchdog is actually running
 * at all - its own "dead-man" check, from outside the function.
 *
 * Usage:
 *   node scripts/backup-verification/verify-watchdog-freshness.mjs \
 *     [--function backupFreshnessWatchdog] [--project pageloom-os-production] [--limit 50]
 *
 * Exit code is non-zero if no heartbeat was found, or if a stale/error/check-failed event
 * was logged more recently than the last heartbeat.
 */
import { fileURLToPath } from "node:url";
import { readWatchdogLogsCommand } from "./lib/gcloud-commands.mjs";
import { runJson } from "./lib/exec.mjs";
import { PRODUCTION_PROJECT_ID } from "./lib/project-guard.mjs";

const HEARTBEAT_EVENT = "watchdog.heartbeat";
const CONCERNING_EVENTS = [
  "watchdog.firestore_backup_stale",
  "watchdog.storage_backup_stale",
  "watchdog.service_health_incident",
  "watchdog.check_failed",
];

function parseArgs(argv) {
  const flag = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
  return {
    functionName: flag("--function", "backupFreshnessWatchdog"),
    project: flag("--project", PRODUCTION_PROJECT_ID),
    limit: Number(flag("--limit", "50")),
  };
}

// `gcloud functions logs read --format=json` entries look like { log, level, time_utc, ... },
// where `log` is "<event> <json-fields>" (firebase-functions/logger's text rendering).
export function summarizeWatchdogLogEntries(entries) {
  const withEvent = (entries ?? []).map((entry) => {
    const text = entry.log ?? entry.textPayload ?? "";
    const event = CONCERNING_EVENTS.find((name) => text.includes(name)) ?? (text.includes(HEARTBEAT_EVENT) ? HEARTBEAT_EVENT : null);
    return { event, timestamp: entry.time_utc ?? entry.timestamp ?? null, raw: text };
  }).filter((entry) => entry.event);

  const heartbeats = withEvent.filter((e) => e.event === HEARTBEAT_EVENT);
  const concerning = withEvent.filter((e) => e.event !== HEARTBEAT_EVENT);

  return {
    entriesScanned: (entries ?? []).length,
    heartbeatFound: heartbeats.length > 0,
    lastHeartbeat: heartbeats[0]?.timestamp ?? null,
    concerningEvents: concerning.map((e) => ({ event: e.event, timestamp: e.timestamp })),
  };
}

function main() {
  const { functionName, project, limit } = parseArgs(process.argv.slice(2));
  const entries = runJson(readWatchdogLogsCommand(functionName, { projectId: project, limit }));
  const summary = { functionName, project, ...summarizeWatchdogLogEntries(entries) };
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.heartbeatFound || summary.concerningEvents.length > 0) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
