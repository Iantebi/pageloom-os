/**
 * Pure verdict logic for a real restore drill: compares a restored temporary database with the
 * live production database it was exported from. No I/O - see ../verify-restore.mjs for the REST
 * side and restore-compare.test.mjs for the scenarios.
 *
 * A managed Firestore export is NOT a point-in-time snapshot: it runs from `startTime` to
 * `endTime`, and a document written in that window may be exported in either its old or new form.
 * Production also keeps changing after the export. So every production document is classified by
 * its createTime/updateTime relative to the export window:
 *
 *   existed before the export started (createTime <= start):
 *     - unchanged since (updateTime <= start)  -> MUST be restored and field-identical ("verified")
 *     - changed during the export window       -> MUST be restored; either version is valid
 *     - changed after the export ended         -> MUST be restored; content not comparable
 *   created during the window (start < createTime <= end) -> may or may not be in the export
 *   created after the export ended                         -> must NOT be required
 *   restored but no longer in production                   -> deleted since; allowed, counted
 *
 * The verdict is PASS only if: the import operation SUCCEEDED, the restored document count equals
 * what the export and the import both report, nothing that had to be restored is missing, no
 * unchanged document differs, AND enough of the restore could actually be verified field-by-field
 * (minVerifiedRatio) - otherwise a heavily-changed production could make a partial restore look
 * fine. Too little verifiable data gives INCONCLUSIVE, never PASS.
 */

/** Deterministic JSON of a Firestore REST `fields` map: object keys sorted at every level. */
export function canonicalFields(value) {
  if (Array.isArray(value)) return value.map(canonicalFields);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonicalFields(value[k])]));
  }
  return value;
}

const sameFields = (a, b) => JSON.stringify(canonicalFields(a ?? {})) === JSON.stringify(canonicalFields(b ?? {}));
const t = (iso) => {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) throw new Error(`invalid timestamp: ${iso}`);
  return ms;
};

/**
 * @param {object} input
 * @param {{state: string, startTime: string, endTime: string, documents: number}} input.exportOp
 * @param {{state: string, documents: number} | null} input.importOp
 * @param {Map<string, {createTime: string, updateTime: string, fields?: object}>} input.production
 * @param {Map<string, {fields?: object}>} input.restored
 * @param {number} [input.minVerifiedRatio=0.9]
 */
export function evaluateRestore({ exportOp, importOp, production, restored, minVerifiedRatio = 0.9 }) {
  const reasons = [];
  if (!exportOp || exportOp.state !== "SUCCESSFUL") reasons.push("export operation is not SUCCESSFUL");
  if (!importOp) reasons.push("no import operation found for this export in the restore database");
  else if (importOp.state !== "SUCCESSFUL") reasons.push(`import operation state is ${importOp.state}`);

  const start = t(exportOp.startTime);
  const end = t(exportOp.endTime);
  const s = {
    exportedDocs: Number(exportOp.documents), importedDocs: importOp ? Number(importOp.documents) : null,
    restoredDocs: restored.size, productionDocs: production.size,
    verifiedIdentical: 0, fieldMismatch: 0, missingFromRestore: 0,
    changedDuringExportPresent: 0, changedAfterExportPresent: 0,
    createdDuringExport: 0, createdAfterExport: 0, deletedSinceExport: 0,
  };
  const missingExamples = [];

  for (const [path, doc] of production) {
    const created = t(doc.createTime);
    const updated = t(doc.updateTime);
    if (created > end) { s.createdAfterExport += 1; continue; }
    if (created > start) { s.createdDuringExport += 1; continue; }
    const copy = restored.get(path);
    if (!copy) { s.missingFromRestore += 1; if (missingExamples.length < 5) missingExamples.push(path.split("/").slice(0, 2).join("/")); continue; }
    if (updated <= start) sameFields(doc.fields, copy.fields) ? (s.verifiedIdentical += 1) : (s.fieldMismatch += 1);
    else if (updated <= end) s.changedDuringExportPresent += 1;
    else s.changedAfterExportPresent += 1;
  }
  for (const path of restored.keys()) if (!production.has(path)) s.deletedSinceExport += 1;

  if (s.restoredDocs === 0) reasons.push("restore database is empty");
  if (s.restoredDocs !== s.exportedDocs) reasons.push(`restored ${s.restoredDocs} documents but the export reports ${s.exportedDocs}`);
  if (importOp && s.importedDocs !== s.exportedDocs) reasons.push(`import reports ${s.importedDocs} documents but the export reports ${s.exportedDocs}`);
  if (s.missingFromRestore > 0) reasons.push(`${s.missingFromRestore} documents that existed before the export are missing (e.g. ${missingExamples.join(", ")})`);
  if (s.fieldMismatch > 0) reasons.push(`${s.fieldMismatch} documents unchanged since the export differ from their restored copy`);

  const verifiedRatio = s.restoredDocs ? s.verifiedIdentical / s.restoredDocs : 0;
  s.verifiedRatio = Math.round(verifiedRatio * 1000) / 1000;
  let verdict = reasons.length ? "FAIL" : "PASS";
  if (verdict === "PASS" && verifiedRatio < minVerifiedRatio) {
    verdict = "INCONCLUSIVE";
    reasons.push(`only ${(verifiedRatio * 100).toFixed(1)}% of restored documents could be verified field-by-field (need ${minVerifiedRatio * 100}%) - production changed too much since the export; re-run with a fresher export`);
  }
  return { verdict, reasons, stats: s };
}
