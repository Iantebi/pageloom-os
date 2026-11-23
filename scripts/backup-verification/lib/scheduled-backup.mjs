/**
 * Verdict for ONE scheduled run of dailyFirestoreBackup (and the watchdog runs after it) - the
 * definitive proof after an IAM or code change, because it exercises the real path end to end:
 * Scheduler -> function -> ExportDocuments (permission checked by Google) -> Firestore service agent
 * writes the files -> completion marker -> watchdog sees it. Pure - see ../verify-scheduled-backup.mjs.
 *
 * A manual run that records `already_completed` is NOT accepted here: the export must have actually
 * STARTED and SUCCEEDED on the scheduled day.
 */
export function evaluateScheduledBackup({ day, backupSa, audit, exportOp, runRecord, completionMarker, watchdogEntries, now }) {
  const reasons = [];
  const prefix = `/firestore/${day}`;

  if (!audit) reasons.push(`no ExportDocuments audit entry for ${day}`);
  else {
    if (audit.principal !== backupSa) reasons.push(`export was called by ${audit.principal}, not ${backupSa}`);
    const exportCheck = (audit.authorizationInfo ?? []).find((a) => a.permission === "datastore.databases.export");
    if (!exportCheck) reasons.push("audit entry has no datastore.databases.export authorization check");
    else if (exportCheck.granted !== true) reasons.push("datastore.databases.export was NOT granted");
    if (audit.statusCode && audit.statusCode !== 0) reasons.push(`ExportDocuments returned error code ${audit.statusCode}: ${audit.statusMessage ?? ""}`);
  }

  if (!exportOp) reasons.push(`no export operation for ${prefix}`);
  else {
    if (!String(exportOp.outputUriPrefix ?? "").endsWith(prefix)) reasons.push("export operation targets a different path");
    if (exportOp.state !== "SUCCESSFUL") reasons.push(`export operation state is ${exportOp.state}`);
    if (!(Number(exportOp.documents) > 0)) reasons.push("export operation exported 0 documents");
  }

  if (!runRecord) reasons.push("no backup run record for the scheduled run");
  else if (runRecord.status !== "started") reasons.push(`run record status is ${runRecord.status} (a scheduled run must start a new export)`);
  else if (exportOp && runRecord.operationName !== exportOp.name) reasons.push("run record points to a different export operation");

  if (!completionMarker) reasons.push(`no .overall_export_metadata completion marker under ${prefix}`);

  const end = exportOp?.endTime ? Date.parse(exportOp.endTime) : NaN;
  const after = (watchdogEntries ?? []).filter((e) => Number.isFinite(end) && Date.parse(e.timestamp) > end);
  const errors = after.filter((e) => e.severity === "ERROR" || e.severity === "CRITICAL");
  const heartbeats = after.filter((e) => e.message === "watchdog.heartbeat");
  if (errors.length) reasons.push(`watchdog logged ${errors.length} error(s) after the export: ${[...new Set(errors.map((e) => e.message))].join(", ")}`);
  let verdict = reasons.length ? "FAIL" : "PASS";
  if (verdict === "PASS" && heartbeats.length === 0) {
    const waitedH = Number.isFinite(end) ? (Date.parse(now) - end) / 3_600_000 : 0;
    if (waitedH > 7) { verdict = "FAIL"; reasons.push("no watchdog heartbeat within 7h after the export"); }
    else { verdict = "PENDING"; reasons.push("export verified; waiting for the next watchdog heartbeat (runs every 6h) - re-run later"); }
  }
  return { verdict, reasons, heartbeatsAfterExport: heartbeats.length };
}
