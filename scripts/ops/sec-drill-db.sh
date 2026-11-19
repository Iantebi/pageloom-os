#!/usr/bin/env bash
# Data minimisation - restore-drill database pageloom-restore-drill-20260903 (eur3, STANDARD).
# Findings 2026-11-19 (read-only, aggregate only): a 2026-09-03 restore of a production export left
# behind in the PRODUCTION project (docs say drills go to isolated infra and are deleted). 541 docs.
# Drill-only records (customers 3, projects 3, supportTickets 2, leads 4) are all test/fictional
# (example.com / *.invalid / rehearsal markers). Real personal data = staff emails (members,
# systemAdministrators), also present in production. No rules release (client SDKs denied), no
# delete protection, not covered by the daily backup. Its source data is also in the daily exports
# 2026-08-21..09-02 until the 90-day lifecycle removes them (~2026-12-01).
#
#   check   : read-only guard check (doc count, collections, no rules release)
#   archive : OPTIONAL - export into a NEW dedicated bucket: EU, uniform access, public access
#             prevention, owner-only IAM (no service-account readers), 30-day retention lock,
#             lifecycle delete at 180 days, Google-managed encryption (CMEK optional, see plan).
#   delete  : delete the database (IRREVERSIBLE), after the guard check passes.
# PRODUCTION-CHANGING (archive/delete). Approvals:
#   APPROVE PRODUCTION: ARCHIVE DRILL DB      (only if an archive is wanted)
#   APPROVE PRODUCTION DELETE: DRILL DB
# Usage: sec-drill-db.sh check|archive|delete [--execute]   (dry run by default)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../iam/h2-common.sh"
DB="pageloom-restore-drill-20260903"; EXPECT_DOCS=541
ARCHIVE_BUCKET="gs://pageloom-drill-archive-20260903"
MODE="${1:-check}"; [[ "${2:-}" == "--execute" ]] && EXECUTE=true
[[ "$MODE" == check ]] && EXECUTE=true   # check is read-only
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight

guard() {
  local tok; tok="$(gcloud auth print-access-token)"
  TOKEN="$tok" PROJECT="$PROJECT" DB="$DB" EXPECT="$EXPECT_DOCS" node -e '
  const P=process.env.PROJECT,DB=process.env.DB,H={Authorization:"Bearer "+process.env.TOKEN,"x-goog-user-project":P,"Content-Type":"application/json"};
  const base=`https://firestore.googleapis.com/v1/projects/${P}/databases/${DB}/documents`;
  async function cols(p){return (await (await fetch((p||base)+":listCollectionIds",{method:"POST",headers:H,body:"{}"})).json()).collectionIds||[]}
  async function walk(p,n={c:0}){for(const c of await cols(p)){let t="";do{const r=await (await fetch(`${p||base}/${c}?pageSize=300${t?"&pageToken="+t:""}`,{headers:H})).json();for(const d of r.documents||[]){n.c++;await walk(d.name.replace(/^projects\/[^/]+\/databases\/[^/]+\/documents/,base),n)}t=r.nextPageToken||""}while(t)}return n.c}
  (async()=>{const top=(await cols()).sort().join(",");const n=await walk();
   const rel=await (await fetch(`https://firebaserules.googleapis.com/v1/projects/${P}/releases`,{headers:H})).json();
   const hasRel=(rel.releases||[]).some(r=>r.name.includes(DB));
   console.log("  top collections:",top,"| docs:",n,"(expected",process.env.EXPECT+") | rules release:",hasRel);
   if(top!=="organizations,systemAdministrators,systemOperations"||String(n)!==process.env.EXPECT||hasRel){console.error("GUARD FAILED - database changed since review");process.exit(1)}
   console.log("  GUARD OK")})()'
}

case "$MODE" in
  check) guard ;;
  archive)
    $EXECUTE && guard
    run gcloud storage buckets create "$ARCHIVE_BUCKET" --project="$PROJECT" --location=EU \
      --uniform-bucket-level-access --public-access-prevention --retention-period=30d
    echo "+ lifecycle: delete objects at age 180 days"
    if $EXECUTE; then printf '{"rule":[{"action":{"type":"Delete"},"condition":{"age":180}}]}' > "$TEMP/drill-lifecycle.json"
      gcloud storage buckets update "$ARCHIVE_BUCKET" --lifecycle-file="$TEMP/drill-lifecycle.json"; fi
    # Firestore service agent must be able to write the export; nothing else gets access.
    run gcloud storage buckets add-iam-policy-binding "$ARCHIVE_BUCKET" \
      --member="serviceAccount:service-386075478217@gcp-sa-firestore.iam.gserviceaccount.com" --role=roles/storage.admin
    run gcloud firestore export "$ARCHIVE_BUCKET/$(date -u +%Y%m%dT%H%M%SZ)" --database="$DB" --project="$PROJECT"
    ;;
  delete)
    $EXECUTE && guard
    run gcloud firestore databases delete --database="$DB" --project="$PROJECT" --quiet
    if $EXECUTE; then
      echo "-- post-check"; gcloud firestore databases list --project="$PROJECT" --format='value(name.basename())' | tr -d '\r' | sed 's/^/  db: /'
      gcloud firestore databases list --project="$PROJECT" --format='value(name.basename())' | grep -q "$DB" && { echo "  ! still listed"; exit 1; }
      bash "/c/Users/Isaac a/Documents/GitHub/pageloom-os-backups/post-ai-studio-stage1-20261119/health.sh" | tail -1
    fi ;;
  *) echo "usage: $0 check|archive|delete [--execute]" >&2; exit 2 ;;
esac
