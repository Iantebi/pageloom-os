#!/usr/bin/env node
/**
 * Read-only: verifies one SCHEDULED dailyFirestoreBackup run end to end (see lib/scheduled-backup.mjs).
 *   node verify-scheduled-backup.mjs [YYYY-MM-DD]   (export folder date; default = today UTC)
 * Exit 0 PASS, 1 FAIL, 2 PENDING (export proven, watchdog heartbeat not yet due), 3 error.
 * Env: TOKEN. API_BASES overrides the Google API roots as JSON (tests only).
 * Reads: Cloud Audit Logs (Admin Activity), Firestore operations + the run-record collection,
 * the backup bucket listing, the watchdog's logs. Prints no document contents.
 */
import { fileURLToPath } from "node:url";
import { evaluateScheduledBackup } from "./lib/scheduled-backup.mjs";
import { BACKUP_SA, PROJECT } from "./lib/backup-iam-matrix.mjs";
import { assertOverrideIsLoopback } from "./lib/safe-endpoint.mjs";

const BUCKET = "pageloom-os-production-backups";
const DEFAULT_BASES = { logging: "https://logging.googleapis.com/v2", firestore: "https://firestore.googleapis.com/v1", storage: "https://storage.googleapis.com/storage/v1" };

export async function collect(day, { token, bases = DEFAULT_BASES, fetchImpl = fetch }) {
  const H = { Authorization: `Bearer ${token}`, "x-goog-user-project": PROJECT, "Content-Type": "application/json" };
  const call = async (url, init) => {
    const r = await fetchImpl(url, { headers: H, ...init });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url.split("?")[0]}`);
    return r.json();
  };
  const from = new Date(Date.parse(`${day}T00:00:00Z`) - 2 * 3_600_000).toISOString(); // covers the 23:30 UTC (summer) run
  const logs = async (filter) => (await call(`${bases.logging}/entries:list`, { method: "POST", body: JSON.stringify({ resourceNames: [`projects/${PROJECT}`], filter: `${filter} AND timestamp>="${from}"`, orderBy: "timestamp asc", pageSize: 200 }) })).entries ?? [];

  const db = `${bases.firestore}/projects/${PROJECT}/databases/(default)`;
  const ops = (await call(`${db}/operations?pageSize=200`)).operations ?? [];
  const op = ops.find((o) => /ExportDocuments/.test(o.metadata?.["@type"] ?? "") && String(o.metadata?.outputUriPrefix ?? "").endsWith(`/firestore/${day}`));
  const exportOp = op && { name: op.name, state: op.metadata.operationState, outputUriPrefix: op.metadata.outputUriPrefix, documents: op.metadata.progressDocuments?.completedWork, endTime: op.metadata.endTime };

  const audits = await logs('protoPayload.methodName="google.firestore.admin.v1.FirestoreAdmin.ExportDocuments"');
  const pick = audits.find((e) => exportOp && e.protoPayload?.response?.name === exportOp.name)
    ?? audits.find((e) => String(e.protoPayload?.request?.outputUriPrefix ?? "").endsWith(`/firestore/${day}`))
    ?? audits[0];
  const audit = pick && { principal: pick.protoPayload?.authenticationInfo?.principalEmail, authorizationInfo: pick.protoPayload?.authorizationInfo, statusCode: pick.protoPayload?.status?.code, statusMessage: pick.protoPayload?.status?.message };

  const runs = (await call(`${db}/documents/systemOperations/backups/runs?pageSize=300&mask.fieldPaths=status&mask.fieldPaths=operationName`)).documents ?? [];
  const rec = exportOp && runs.find((d) => d.fields?.operationName?.stringValue === exportOp.name);
  const runRecord = rec ? { status: rec.fields?.status?.stringValue, operationName: rec.fields?.operationName?.stringValue } : null;

  const listing = await call(`${bases.storage}/b/${BUCKET}/o?prefix=${encodeURIComponent(`firestore/${day}/`)}&fields=items(name)`);
  const completionMarker = (listing.items ?? []).some((i) => i.name.endsWith(".overall_export_metadata"));

  const wd = await logs('resource.type="cloud_run_revision" AND resource.labels.service_name="backupfreshnesswatchdog" AND (severity>=ERROR OR jsonPayload.message="watchdog.heartbeat")');
  const watchdogEntries = wd.map((e) => ({ timestamp: e.timestamp, severity: e.severity, message: String(e.jsonPayload?.message ?? e.textPayload ?? "").split("\n")[0].replace(/^Error: /, "") }));

  return { day, backupSa: BACKUP_SA, audit, exportOp, runRecord, completionMarker, watchdogEntries, now: new Date().toISOString() };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const day = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("date must be YYYY-MM-DD");
    if (!process.env.TOKEN) throw new Error("TOKEN is required");
    const input = await collect(day, { token: process.env.TOKEN, ...(process.env.API_BASES ? { bases: Object.fromEntries(Object.entries(JSON.parse(process.env.API_BASES)).map(([k, v]) => [k, assertOverrideIsLoopback(`API_BASES.${k}`, v)])) } : {}) });
    const result = evaluateScheduledBackup(input);
    console.log(JSON.stringify({ day, exportOp: input.exportOp && { state: input.exportOp.state, documents: input.exportOp.documents, endTime: input.exportOp.endTime }, runRecord: input.runRecord?.status ?? null,
      exportPermissionGranted: (input.audit?.authorizationInfo ?? []).find((a) => a.permission === "datastore.databases.export")?.granted ?? null,
      completionMarker: input.completionMarker, ...result }, null, 1));
    process.exit({ PASS: 0, FAIL: 1, PENDING: 2 }[result.verdict]);
  } catch (error) {
    console.error(`ERROR (fail closed): ${error.message}`);
    process.exit(3);
  }
}
