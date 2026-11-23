#!/usr/bin/env bash
# Least privilege for the two backup service accounts (2026-11-23 audit). Each stage is separate,
# reversible, and PROVEN before and after with the Policy Troubleshooter (read-only, evaluates IAM
# conditions) - see scripts/backup-verification/lib/backup-iam-matrix.mjs for every check.
#
#  exporter : pageloom-backup has roles/datastore.importExportAdmin, which also grants
#             datastore.databases.import - a leaked token could overwrite production with an import -
#             and export of every database in the project. Evidence: the Admin Activity audit log of
#             every daily ExportDocuments call checks exactly one permission, datastore.databases.export.
#             Replace it with custom role pageloomFirestoreExporter (export + read-only metadata/
#             operations) limited to the (default) database by the H2 IAM condition.
#  bucket   : pageloom-backup has roles/storage.objectAdmin on the backups bucket; the export files are
#             written by the Firestore service agent (storage.admin there) and the backup code never
#             touches Cloud Storage. Remove it.
#  workers  : pageloom-workers has roles/datastore.user (condition default-db-only); the watchdog never
#             reads or writes Firestore. Remove it.
# Kept: pageloomBackupWriter (run records), the Firestore service agent's storage.admin on the bucket,
# workers' objectViewer/logWriter/storagetransfer.viewer/servicehealth.viewer, both run.invoker grants.
#
# Proof per stage (all read-only except `verify`, which runs the two Scheduler jobs once):
#   1. before the change: the matrix of the previous phase must pass, or the stage refuses to start;
#   2. exporter only: after granting the new role and BEFORE removing the old one, the troubleshooter
#      must show export granted BY THE NEW ROLE - otherwise the old role is not removed;
#   3. after the change: the matrix of the new phase must pass (removed access gone, needed access kept),
#      otherwise the stage prints its rollback and exits 1;
#   4. `verify` (~10 min later, after IAM propagation): one manual run of each job; the export call's
#      AUDIT entry must show datastore.databases.export granted=true (a duplicate-path answer alone is
#      not accepted), and the watchdog must log a heartbeat and no ERROR;
#   5. `verify-scheduled` after the next 00:30 UTC run: the definitive end-to-end check - a NEW export
#      started by the schedule, permission granted in the audit log, operation SUCCESSFUL, completion
#      marker present, run record `started`, next watchdog heartbeat clean.
#
# PRODUCTION-CHANGING (IAM). Approval per stage, e.g.: APPROVE PRODUCTION IAM: BACKUP EXPORTER ROLE
# Usage: sec-backup-iam-least-privilege.sh exporter|bucket|workers [--execute]
#        sec-backup-iam-least-privilege.sh check <phase>              (read-only, always runs)
#        sec-backup-iam-least-privilege.sh verify [--execute]
#        sec-backup-iam-least-privilege.sh verify-scheduled [YYYY-MM-DD]   (read-only)
#        sec-backup-iam-least-privilege.sh rollback-exporter|rollback-bucket|rollback-workers [--execute]
# Dry run by default. Never run a change between 00:00 and 01:00 UTC (daily export at 00:30 UTC).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/../iam/h2-common.sh"
BV="$HERE/../backup-verification"

BACKUP_SA="pageloom-backup@${DOMAIN}"
ROLE_ID="pageloomFirestoreExporter"
ROLE="projects/${PROJECT}/roles/${ROLE_ID}"
ROLE_PERMS="datastore.databases.export,datastore.databases.getMetadata,datastore.operations.get,datastore.operations.list"
BACKUP_JOB="firebase-schedule-dailyFirestoreBackup-europe-west1"
WATCHDOG_JOB="firebase-schedule-backupFreshnessWatchdog-europe-west1"

MODE="${1:-}"; ARG="${2:-}"; [[ "$ARG" == "--execute" ]] && EXECUTE=true
[[ "$MODE" == check || "$MODE" == verify-scheduled ]] && EXECUTE=true   # read-only
[[ -n "$MODE" ]] || { echo "usage: $0 exporter|bucket|workers|check <phase>|verify|verify-scheduled [day]|rollback-* [--execute]" >&2; exit 2; }
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight

token() { gcloud auth print-access-token | tr -d '\r'; }
iam_check() { echo "-- IAM matrix: $1"; TOKEN="$(token)" node "$BV/check-backup-iam.mjs" "$1"; }
must_pass() {
  iam_check "$1" && return 0
  if ! $EXECUTE; then echo "  (dry run) a real run would ABORT here: IAM phase '$1' is not the current state" >&2; return 0; fi
  echo "ABORT: IAM phase '$1' is not as expected - nothing (further) changed${2:+. Undo: $0 $2 --execute}" >&2; exit 1
}
not_in_backup_window() {
  local hm; hm="$(date -u +%H%M)"
  if [[ "$hm" < "0100" ]]; then echo "ABORT: 00:00-01:00 UTC is the backup window" >&2; exit 1; fi
}

case "$MODE" in
  check) iam_check "${ARG:?phase required: current|after-grant|after-exporter|after-bucket|after-workers}" ;;
  verify-scheduled) TOKEN="$(token)" node "$BV/verify-scheduled-backup.mjs" ${ARG:+"$ARG"} ;;
  exporter)
    must_pass current
    $EXECUTE && not_in_backup_window
    if $EXECUTE && gcloud iam roles describe "$ROLE_ID" --project="$PROJECT" >/dev/null 2>&1; then
      echo "custom role $ROLE_ID already exists - reusing it"
    else
      run gcloud iam roles create "$ROLE_ID" --project="$PROJECT" --title="PageLoom Firestore Exporter" \
        --description="dailyFirestoreBackup: start and read Firestore exports only (no import)" --permissions="$ROLE_PERMS" --stage=GA
    fi
    run gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$BACKUP_SA" --role="$ROLE" --condition="$DEFAULT_DB_CONDITION"
    if $EXECUTE; then
      ok=false; for _ in 1 2 3 4 5 6; do iam_check after-grant && { ok=true; break; }; sleep "${IAM_POLL_SECONDS:-30}"; done
      $ok || { echo "ABORT: the new role does not grant export - importExportAdmin was NOT removed. Undo: $0 rollback-exporter --execute" >&2; exit 1; }
    fi
    run gcloud projects remove-iam-policy-binding "$PROJECT" --member="serviceAccount:$BACKUP_SA" --role=roles/datastore.importExportAdmin --condition=None
    if $EXECUTE; then must_pass after-exporter rollback-exporter; echo "Next: wait ~10 min, then $0 verify --execute"; fi ;;
  rollback-exporter)
    run gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$BACKUP_SA" --role=roles/datastore.importExportAdmin --condition=None
    run_tolerant gcloud projects remove-iam-policy-binding "$PROJECT" --member="serviceAccount:$BACKUP_SA" --role="$ROLE" --all
    if $EXECUTE; then must_pass current; fi ;;
  bucket)
    must_pass after-exporter
    $EXECUTE && not_in_backup_window
    run gcloud storage buckets remove-iam-policy-binding "$BACKUP_BUCKET" --member="serviceAccount:$BACKUP_SA" --role=roles/storage.objectAdmin
    if $EXECUTE; then must_pass after-bucket rollback-bucket; echo "Next: after the next 00:30 UTC run, $0 verify-scheduled"; fi ;;
  rollback-bucket)
    run gcloud storage buckets add-iam-policy-binding "$BACKUP_BUCKET" --member="serviceAccount:$BACKUP_SA" --role=roles/storage.objectAdmin ;;
  workers)
    must_pass after-bucket
    $EXECUTE && not_in_backup_window
    run gcloud projects remove-iam-policy-binding "$PROJECT" --member="serviceAccount:$WORKERS_SA" --role=roles/datastore.user --all
    if $EXECUTE; then must_pass after-workers rollback-workers; echo "Next: wait ~10 min, then $0 verify --execute"; fi ;;
  rollback-workers)
    run gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$WORKERS_SA" --role=roles/datastore.user --condition="$DEFAULT_DB_CONDITION" ;;
  verify)
    # Interim evidence only (the definitive check is verify-scheduled). Runs each job once; today's
    # export already exists, so no second export is created.
    $EXECUTE && not_in_backup_window
    since="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    run gcloud scheduler jobs run "$BACKUP_JOB" --location=europe-west1 --project="$PROJECT"
    run gcloud scheduler jobs run "$WATCHDOG_JOB" --location=europe-west1 --project="$PROJECT"
    if $EXECUTE; then
      echo "waiting ${VERIFY_WAIT_SECONDS:-120}s for both runs and their logs..."; sleep "${VERIFY_WAIT_SECONDS:-120}"
      granted="$(gcloud logging read "protoPayload.methodName=\"google.firestore.admin.v1.FirestoreAdmin.ExportDocuments\" AND protoPayload.authenticationInfo.principalEmail=\"$BACKUP_SA\" AND timestamp>=\"$since\"" \
        --project="$PROJECT" --limit=1 --format='value(protoPayload.authorizationInfo[0].permission,protoPayload.authorizationInfo[0].granted)' | tr -d '\r')"
      echo "  export call audit: ${granted:-<none>}"
      [[ "$granted" == $'datastore.databases.export\tTrue' || "$granted" == "datastore.databases.export True" ]] || { echo "  FAIL: no audit entry with datastore.databases.export granted - roll back the last stage" >&2; exit 1; }
      wd="$(gcloud logging read "resource.labels.service_name=\"backupfreshnesswatchdog\" AND timestamp>=\"$since\" AND (severity>=ERROR OR jsonPayload.message=\"watchdog.heartbeat\")" \
        --project="$PROJECT" --limit=20 --format='value(severity,jsonPayload.message)' | tr -d '\r')"
      echo "$wd" | sed 's/^/  watchdog: /'
      grep -q "watchdog.heartbeat" <<<"$wd" || { echo "  FAIL: no watchdog heartbeat" >&2; exit 1; }
      ! grep -qE "^(ERROR|CRITICAL)" <<<"$wd" || { echo "  FAIL: watchdog logged an error - roll back the last stage" >&2; exit 1; }
      echo "  interim PASS. Definitive: after the next 00:30 UTC run, $0 verify-scheduled"
    fi ;;
  *) echo "unknown mode $MODE" >&2; exit 2 ;;
esac
