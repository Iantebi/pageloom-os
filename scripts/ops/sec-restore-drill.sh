#!/usr/bin/env bash
# Real restore drill: imports a daily production export into a NEW, temporary Firestore database in
# the same project/location (eur3), verifies it against production, then deletes it. Production
# (default) is only ever READ. Same procedure as the 2026-08-31 drill (runbook §10), hardened after
# the 2026-09-03 drill database was left behind (see sec-drill-db.sh).
#
# Stages, each run separately and in order:  create -> import -> verify -> delete   (+ status)
#   status : read-only; lists databases and flags any drill database older than 24 h as a LEFTOVER
#   create : refuses if the target already exists
#   import : refuses unless the target exists and is EMPTY; on failure the target may hold partial
#            data -> run delete (exit 6)
#   verify : read-only; scripts/backup-verification/verify-restore.mjs - PASS 0 / FAIL 1 /
#            INCONCLUSIVE 2 / error 3. Handles documents changed during/after the export (see
#            lib/restore-compare.mjs); a partial restore can never PASS.
#   delete : refuses anything not named pageloom-restore-drill-YYYYMMDD, refuses a database with
#            delete protection enabled (a drill database never has it), then confirms the database
#            is gone (polls). Exit 4 = delete command failed, 5 = still listed - retry delete.
#            Run delete after verify whatever the verdict (the copy holds personal data); keep the
#            database only while actively investigating a FAIL, and delete it the same day.
# PRODUCTION-CHANGING (creates/deletes a temporary database; ~1 cent). Approval:
#   APPROVE PRODUCTION RESTORE DRILL: TEMP DATABASE (create, import, verify, delete)
# Usage: DRILL_DB=pageloom-restore-drill-YYYYMMDD EXPORT_DATE=YYYY-MM-DD sec-restore-drill.sh <stage> [--execute]
# Dry run by default (status and verify are read-only and always run).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/../iam/h2-common.sh"
VERIFY_JS="$HERE/../backup-verification/verify-restore.mjs"
POLL_SECONDS="${DRILL_POLL_SECONDS:-10}"

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

list_dbs() { gcloud firestore databases list --project="$PROJECT" --format='value(name.basename())' | tr -d '\r'; }
db_exists() { list_dbs | grep -qx "$DB"; }
verify_js() { PROJECT="$PROJECT" DRILL_DB="$DB" SOURCE="$SOURCE" TOKEN="$(gcloud auth print-access-token | tr -d '\r')" node "$VERIFY_JS" "$1"; }
leftover_report() {
  local now name created age; now="$(date -u +%s)"
  while read -r name created; do
    [[ "$name" =~ ^pageloom-restore-drill- ]] || continue
    age=$(( (now - $(date -u -d "$created" +%s 2>/dev/null || echo "$now")) / 3600 ))
    if (( age >= 24 )); then echo "  LEFTOVER: $name is ${age}h old - delete it (holds a copy of production data)"; else echo "  drill database present: $name (${age}h)"; fi
  done < <(gcloud firestore databases list --project="$PROJECT" --format='value(name.basename(),createTime)' | tr -d '\r')
}

case "$MODE" in
  status)
    list_dbs | sed 's/^/  db: /'
    leftover_report ;;
  create)
    if $EXECUTE && db_exists; then echo "ABORT: $DB already exists" >&2; exit 1; fi
    run gcloud firestore databases create --database="$DB" --location=eur3 --type=firestore-native --delete-protection=false --project="$PROJECT" ;;
  import)
    if $EXECUTE; then
      db_exists || { echo "ABORT: $DB does not exist (run create)" >&2; exit 1; }
      verify_js empty >/dev/null || { echo "ABORT: $DB is not empty (or could not be checked) - refusing to import into it" >&2; exit 1; }
    fi
    if ! run gcloud firestore import "$SOURCE" --database="$DB" --project="$PROJECT"; then
      echo "IMPORT FAILED: $DB may now hold PARTIAL production data. Run: $0 delete --execute" >&2; exit 6
    fi ;;
  verify)
    db_exists || { echo "ABORT: $DB does not exist" >&2; exit 1; }
    set +e; verify_js full; rc=$?; set -e
    (( rc == 0 )) || echo "Verdict not PASS (exit $rc). Investigate from the report above, then delete $DB today: $0 delete --execute" >&2
    exit "$rc" ;;
  delete)
    if $EXECUTE; then
      db_exists || { echo "nothing to delete: $DB not found"; exit 0; }
      prot="$(gcloud firestore databases describe --database="$DB" --project="$PROJECT" --format='value(deleteProtectionState)' | tr -d '\r')"
      [[ "$prot" != "DELETE_PROTECTION_ENABLED" ]] || { echo "ABORT: $DB has delete protection - not a drill database, refusing" >&2; exit 1; }
    fi
    if ! run gcloud firestore databases delete --database="$DB" --project="$PROJECT" --quiet; then
      echo "DELETE FAILED: $DB still exists (holds production data). Retry: $0 delete --execute" >&2; exit 4
    fi
    if $EXECUTE; then
      for _ in 1 2 3 4 5 6; do db_exists || { echo "  deleted; databases now:"; list_dbs | sed 's/^/    /'; exit 0; }; sleep "$POLL_SECONDS"; done
      echo "  ! $DB still listed after deletion - retry: $0 delete --execute" >&2; exit 5
    fi ;;
  *) echo "usage: $0 status|create|import|verify|delete [--execute]" >&2; exit 2 ;;
esac
