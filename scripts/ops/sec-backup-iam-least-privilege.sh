#!/usr/bin/env bash
# Least privilege for the two backup service accounts (2026-11-23 audit). Each stage is separate,
# reversible, and verified before the next one.
#
#  exporter : pageloom-backup has roles/datastore.importExportAdmin, which also grants
#             datastore.databases.import - a leaked token could overwrite production with an import.
#             Evidence: the Admin Activity audit log of every daily ExportDocuments call checks
#             exactly one permission, datastore.databases.export. Replace the role with a custom
#             role pageloomFirestoreExporter (export + read-only metadata/operations), limited to the
#             (default) database by the same IAM condition the H2 bindings use.
#  bucket   : pageloom-backup has roles/storage.objectAdmin on the backups bucket, but the export files
#             are written by the Firestore service agent (it holds storage.admin there) - the backup
#             code never touches Cloud Storage. Remove it. (30-day retention already blocks deletes.)
#  workers  : pageloom-workers has roles/datastore.user (condition default-db-only). The watchdog never
#             reads or writes Firestore (it lists GCS objects, Storage Transfer operations, Service Health).
#             Remove it.
# Kept on purpose: pageloomBackupWriter (pageloom-backup writes its run records), the Firestore service
# agent's storage.admin on the bucket, workers' objectViewer/logWriter/storagetransfer/servicehealth.
#
# PRODUCTION-CHANGING (IAM). Approval per stage, e.g.: APPROVE PRODUCTION IAM: BACKUP EXPORTER ROLE
# Usage: sec-backup-iam-least-privilege.sh exporter|bucket|workers|verify [--execute]
#        sec-backup-iam-least-privilege.sh rollback-exporter|rollback-bucket|rollback-workers [--execute]
# Dry run by default. Never run between 00:00 and 01:00 UTC (daily export at 00:30 UTC).
# After each stage wait ~10 minutes (IAM propagation), then run `verify --execute`.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../iam/h2-common.sh"

BACKUP_SA="pageloom-backup@${DOMAIN}"
ROLE_ID="pageloomFirestoreExporter"
ROLE="projects/${PROJECT}/roles/${ROLE_ID}"
ROLE_PERMS="datastore.databases.export,datastore.databases.getMetadata,datastore.operations.get,datastore.operations.list"
BACKUP_JOB="firebase-schedule-dailyFirestoreBackup-europe-west1"
WATCHDOG_JOB="firebase-schedule-backupFreshnessWatchdog-europe-west1"

MODE="${1:-}"; [[ "${2:-}" == "--execute" ]] && EXECUTE=true
[[ -n "$MODE" ]] || { echo "usage: $0 exporter|bucket|workers|verify|rollback-* [--execute]" >&2; exit 2; }
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight

not_in_backup_window() {
  local hm; hm="$(date -u +%H%M)"
  if [[ "$hm" < "0100" ]]; then echo "ABORT: 00:00-01:00 UTC is the backup window" >&2; exit 1; fi
}

case "$MODE" in
  exporter)
    $EXECUTE && not_in_backup_window
    if $EXECUTE && gcloud iam roles describe "$ROLE_ID" --project="$PROJECT" >/dev/null 2>&1; then
      echo "custom role $ROLE_ID already exists - reusing it"
    else
      run gcloud iam roles create "$ROLE_ID" --project="$PROJECT" --title="PageLoom Firestore Exporter" \
        --description="dailyFirestoreBackup: start and read Firestore exports only (no import)" --permissions="$ROLE_PERMS" --stage=GA
    fi
    # Grant the narrow role first, then remove the broad one: no window without export permission.
    run gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$BACKUP_SA" --role="$ROLE" --condition="$DEFAULT_DB_CONDITION"
    run gcloud projects remove-iam-policy-binding "$PROJECT" --member="serviceAccount:$BACKUP_SA" --role=roles/datastore.importExportAdmin --condition=None
    ;;
  rollback-exporter)
    run gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$BACKUP_SA" --role=roles/datastore.importExportAdmin --condition=None
    run_tolerant gcloud projects remove-iam-policy-binding "$PROJECT" --member="serviceAccount:$BACKUP_SA" --role="$ROLE" --all
    ;;
  bucket)
    $EXECUTE && not_in_backup_window
    run gcloud storage buckets remove-iam-policy-binding "$BACKUP_BUCKET" --member="serviceAccount:$BACKUP_SA" --role=roles/storage.objectAdmin
    ;;
  rollback-bucket)
    run gcloud storage buckets add-iam-policy-binding "$BACKUP_BUCKET" --member="serviceAccount:$BACKUP_SA" --role=roles/storage.objectAdmin
    ;;
  workers)
    $EXECUTE && not_in_backup_window
    run gcloud projects remove-iam-policy-binding "$PROJECT" --member="serviceAccount:$WORKERS_SA" --role=roles/datastore.user --all
    ;;
  rollback-workers)
    run gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$WORKERS_SA" --role=roles/datastore.user --condition="$DEFAULT_DB_CONDITION"
    ;;
  verify)
    # Production-changing only in that it runs the two scheduled jobs once (approve with the stage).
    # Today's export folder already exists, so the backup run is expected to record already_completed:
    # that proves the token, the export permission check and the run-record write - without a 2nd export.
    run gcloud scheduler jobs run "$BACKUP_JOB" --location=europe-west1 --project="$PROJECT"
    run gcloud scheduler jobs run "$WATCHDOG_JOB" --location=europe-west1 --project="$PROJECT"
    if $EXECUTE; then
      echo "waiting 90s for both runs..."; sleep 90
      tok="$(gcloud auth print-access-token)"
      TOKEN="$tok" PROJECT="$PROJECT" node -e '
        const H={Authorization:"Bearer "+process.env.TOKEN};
        (async()=>{const r=await (await fetch(`https://firestore.googleapis.com/v1/projects/${process.env.PROJECT}/databases/(default)/documents/systemOperations/backups/runs?pageSize=300&mask.fieldPaths=status`,{headers:H})).json();
        const last=(r.documents||[]).map(d=>[d.name.split("/").pop(),d.fields?.status?.stringValue]).sort((a,b)=>a[0].localeCompare(b[0])).at(-1);
        console.log("  latest backup run:",last.join(" "));if(!["already_completed","started"].includes(last[1])){console.error("  FAIL - roll back this stage");process.exit(1)}})()'
      gcloud logging read 'protoPayload.methodName="google.firestore.admin.v1.FirestoreAdmin.ExportDocuments"' --project="$PROJECT" --freshness=10m --limit=1 \
        --format="value(timestamp,protoPayload.authorizationInfo[0].permission,protoPayload.authorizationInfo[0].granted,protoPayload.status.message)" | sed 's/^/  export audit: /'
      gcloud logging read 'resource.labels.service_name="backupfreshnesswatchdog" AND (severity>=ERROR OR jsonPayload.message="watchdog.heartbeat")' --project="$PROJECT" --freshness=10m --limit=5 \
        --format="value(timestamp,severity,jsonPayload.message)" | sed 's/^/  watchdog: /'
      echo "  Then confirm the next 00:30 UTC export is SUCCESSFUL: gcloud firestore operations list --project=$PROJECT --limit=1"
    fi
    ;;
  *) echo "unknown mode $MODE" >&2; exit 2 ;;
esac
