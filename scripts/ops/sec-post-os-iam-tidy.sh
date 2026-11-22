#!/usr/bin/env bash
# Least privilege after PageLoom OS removal (2026-11-19). Nothing left needs these grants:
#   compute  : project run.invoker + eventarc.eventReceiver, secretAccessor on the 19 (disabled) OS
#              secrets. Keeps cloudbuild.builds.builder (function builds for the backup functions).
#   workers  : project eventarc.eventReceiver (no Eventarc triggers exist any more; the watchdog is
#              scheduler-invoked). Keeps datastore.user[cond], logWriter, storagetransfer/servicehealth
#              viewer and backup-bucket objectViewer (all used by backupFreshnessWatchdog).
# Guard: aborts if any Eventarc trigger exists or anything runs as compute.
# PRODUCTION-CHANGING (IAM). Approval: APPROVE PRODUCTION IAM: POST-OS TIDY
# Dry run by default; --execute to apply. Undo: the matching add-iam-policy-binding commands.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../iam/h2-common.sh"
COMPUTE_SA="386075478217-compute@developer.gserviceaccount.com"
[[ "${1:-}" == "--execute" ]] && EXECUTE=true
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight
if $EXECUTE; then
  [[ "$(gcloud eventarc triggers list --location=eur3 --project="$PROJECT" --format='value(name)' | grep -c . || true)" == 0 ]] || { echo "ABORT: Eventarc triggers exist" >&2; exit 1; }
  [[ "$(gcloud functions list --project="$PROJECT" --format='value(serviceConfig.serviceAccountEmail)' | grep -c "$COMPUTE_SA" || true)" == 0 ]] || { echo "ABORT: a function runs as compute" >&2; exit 1; }
fi
run gcloud projects remove-iam-policy-binding "$PROJECT" --member="serviceAccount:$COMPUTE_SA" --role=roles/run.invoker --condition=None
run gcloud projects remove-iam-policy-binding "$PROJECT" --member="serviceAccount:$COMPUTE_SA" --role=roles/eventarc.eventReceiver --condition=None
run gcloud projects remove-iam-policy-binding "$PROJECT" --member="serviceAccount:$WORKERS_SA" --role=roles/eventarc.eventReceiver --condition=None
for s in "${SECRETS[@]}"; do
  run_tolerant gcloud secrets remove-iam-policy-binding "$s" --project="$PROJECT" --member="serviceAccount:$COMPUTE_SA" --role=roles/secretmanager.secretAccessor
done
