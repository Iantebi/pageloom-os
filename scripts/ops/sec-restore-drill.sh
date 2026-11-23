#!/usr/bin/env bash
# Real restore drill: imports a daily production export into a NEW, temporary Firestore database in
# the same project/location (eur3), verifies it document-by-document against production, then deletes
# it. Production (default) is only ever READ. Same procedure as the 2026-08-31 drill (runbook §10),
# hardened after the 2026-09-03 drill database was left behind (see sec-drill-db.sh).
#
# Stages (run in order, each separately):  create -> import -> verify -> delete   (+ status, read-only)
# PRODUCTION-CHANGING (creates/deletes a temporary database; tiny cost). Approval:
#   APPROVE PRODUCTION RESTORE DRILL: TEMP DATABASE (create, import, verify, delete)
# Usage: DRILL_DB=pageloom-restore-drill-YYYYMMDD EXPORT_DATE=YYYY-MM-DD sec-restore-drill.sh <stage> [--execute]
# Dry run by default. Guards (fail closed): the target name must match pageloom-restore-drill-YYYYMMDD
# and can never be (default); import only into a database that exists and is EMPTY; delete only a
# database with that name pattern.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../iam/h2-common.sh"

DB="${DRILL_DB:-pageloom-restore-drill-$(date -u +%Y%m%d)}"
EXPORT_DATE="${EXPORT_DATE:-$(date -u +%Y-%m-%d)}"
SOURCE="${BACKUP_BUCKET}/firestore/${EXPORT_DATE}"
MODE="${1:-status}"; [[ "${2:-}" == "--execute" ]] && EXECUTE=true
[[ "$MODE" == status || "$MODE" == verify ]] && EXECUTE=true   # read-only stages
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight

[[ "$DB" =~ ^pageloom-restore-drill-[0-9]{8}$ ]] || { echo "ABORT: target must be pageloom-restore-drill-YYYYMMDD (got '$DB')" >&2; exit 1; }
[[ "$DB" != "(default)" ]] || { echo "ABORT: never the production database" >&2; exit 1; }
[[ "$EXPORT_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "ABORT: EXPORT_DATE must be YYYY-MM-DD" >&2; exit 1; }
echo "target database: $DB | source export: $SOURCE"

db_exists() { gcloud firestore databases list --project="$PROJECT" --format='value(name.basename())' | tr -d '\r' | grep -qx "$DB"; }

# Read-only REST helper: counts and compares documents. Prints aggregates only (never field values).
compare() {
  local tok; tok="$(gcloud auth print-access-token)"
  TOKEN="$tok" PROJECT="$PROJECT" DB="$DB" SOURCE="$SOURCE" MODE="$1" node -e '
  const {PROJECT:P,DB,SOURCE,MODE}=process.env,H={Authorization:"Bearer "+process.env.TOKEN,"x-goog-user-project":P,"Content-Type":"application/json"};
  const root=(db)=>`https://firestore.googleapis.com/v1/projects/${P}/databases/${db}/documents`;
  async function j(u,o){const r=await fetch(u,{headers:H,...o});if(!r.ok)throw new Error(`HTTP ${r.status} ${u.split("?")[0]}`);return r.json()}
  async function walk(db){const out=new Map(),base=root(db);
    async function rec(parent){const ids=(await j(parent+":listCollectionIds",{method:"POST",body:"{}"})).collectionIds||[];
      // showMissing: also list "missing" parent documents (no fields, no createTime) so subcollections
      // under a parent that was never written / was deleted are still walked; only real documents
      // (with createTime) are counted - the same set a Firestore export contains.
      for(const c of ids){let t="";do{const r=await j(`${parent}/${c}?pageSize=300&showMissing=true${t?"&pageToken="+t:""}`);
        for(const d of r.documents||[]){const rel=d.name.split("/documents/")[1];if(d.createTime)out.set(rel,d);await rec(base+"/"+rel)}t=r.nextPageToken||""}while(t)}}
    await rec(base);return out}
  // Field maps compared in a canonical (key-sorted) form, so key order can never cause a false mismatch.
  const canon=(v)=>Array.isArray(v)?v.map(canon):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
  (async()=>{
    if(MODE==="empty"){const n=(await walk(DB)).size;console.log("  documents in target:",n);if(n!==0){console.error("ABORT: target is not empty");process.exit(1)}return}
    const ops=await j(`https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/operations?pageSize=200`);
    const op=(ops.operations||[]).find(o=>o.metadata&&o.metadata.outputUriPrefix===SOURCE&&o.metadata.operationState==="SUCCESSFUL");
    if(!op){console.error("ABORT: no SUCCESSFUL export found for",SOURCE);process.exit(1)}
    const exportStart=op.metadata.startTime,exported=Number(op.metadata.progressDocuments.completedWork);
    const t0=Date.now();const [prod,drill]=await Promise.all([walk("(default)"),walk(DB)]);
    let same=0,diff=0,missing=0,newer=0;
    for(const [rel,d] of prod){if(d.updateTime>exportStart){newer++;continue}const r=drill.get(rel);if(!r){missing++;continue}
      JSON.stringify(canon(d.fields||{}))===JSON.stringify(canon(r.fields||{}))?same++:diff++}
    const onlyDrill=[...drill.keys()].filter(k=>!prod.has(k)).length;
    const cols=(m)=>{const c={};for(const k of m.keys()){const top=k.split("/")[0];c[top]=(c[top]||0)+1}return c};
    console.log(JSON.stringify({exportStart,exportedDocs:exported,restoredDocs:drill.size,prodDocsNow:prod.size,
      identicalToProd:same,changedInProdSinceExport:newer,fieldMismatch:diff,missingFromRestore:missing,onlyInRestore_deletedSince:onlyDrill,
      restoredTopCollections:cols(drill),readSeconds:Math.round((Date.now()-t0)/1000)},null,1));
    const ok=drill.size===exported&&diff===0&&missing===0;
    console.log(ok?"  RESTORE VERIFIED":"  RESTORE MISMATCH - keep the database for investigation, do not delete yet");process.exit(ok?0:1)})()'
}

case "$MODE" in
  status)
    gcloud firestore databases list --project="$PROJECT" --format='value(name.basename(),createTime,deleteProtectionState)' | sed 's/^/  db: /'
    gcloud firestore operations list --project="$PROJECT" --format='value(metadata.startTime,metadata.operationState,metadata.outputUriPrefix)' --limit=3 | sed 's/^/  op: /' ;;
  create)
    if $EXECUTE && db_exists; then echo "ABORT: $DB already exists" >&2; exit 1; fi
    run gcloud firestore databases create --database="$DB" --location=eur3 --type=firestore-native --project="$PROJECT" ;;
  import)
    if $EXECUTE; then db_exists || { echo "ABORT: $DB does not exist (run create)" >&2; exit 1; }; compare empty; fi
    run gcloud firestore import "$SOURCE" --database="$DB" --project="$PROJECT" ;;
  verify)
    db_exists || { echo "ABORT: $DB does not exist" >&2; exit 1; }
    compare full ;;
  delete)
    if $EXECUTE; then db_exists || { echo "nothing to delete: $DB not found"; exit 0; }; fi
    run gcloud firestore databases delete --database="$DB" --project="$PROJECT" --quiet
    if $EXECUTE; then db_exists && { echo "  ! $DB still listed" >&2; exit 1; }; echo "  deleted; databases now:"
      gcloud firestore databases list --project="$PROJECT" --format='value(name.basename())' | sed 's/^/    /'; fi ;;
  *) echo "usage: $0 status|create|import|verify|delete [--execute]" >&2; exit 2 ;;
esac
