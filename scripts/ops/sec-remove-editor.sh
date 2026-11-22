#!/usr/bin/env bash
# Security fix A6 (= H2 phase 4) - remove roles/editor from the two default accounts.
#   - 386075478217-compute@: today only Cloud Build uses it (all functions run as H2 accounts; the
#     AI Studio Cloud Run services that ran as it were deleted 2026-11-19). Cloud Build needs
#     roles/cloudbuild.builds.builder, granted FIRST so deploys keep working.
#   - pageloom-os-production@appspot: used by nothing (no App Engine app, no function, no job).
# PRODUCTION-CHANGING (IAM). Approval: APPROVE PRODUCTION IAM: REMOVE EDITOR
# Dry run by default; --execute to apply. Undo: scripts/iam/h2-rollback.sh phase4 (+ appspot below).
# After applying, a deploy (needs its own approval) is the real proof that Cloud Build still works.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../iam/h2-common.sh"
COMPUTE_SA="386075478217-compute@developer.gserviceaccount.com"
APPSPOT_SA="pageloom-os-production@appspot.gserviceaccount.com"
[[ "${1:-}" == "--execute" ]] && EXECUTE=true
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight
if $EXECUTE; then
  n="$(gcloud functions list --project="$PROJECT" --format='value(serviceConfig.serviceAccountEmail)' | grep -c -e "$COMPUTE_SA" -e "$APPSPOT_SA" || true)"
  [[ "$n" == 0 ]] || { echo "ABORT: $n function(s) still run as a default account" >&2; exit 1; }
fi
run gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$COMPUTE_SA" --role=roles/cloudbuild.builds.builder --condition=None
run gcloud projects remove-iam-policy-binding "$PROJECT" --member="serviceAccount:$COMPUTE_SA" --role=roles/editor --condition=None
run gcloud projects remove-iam-policy-binding "$PROJECT" --member="serviceAccount:$APPSPOT_SA" --role=roles/editor --condition=None
echo "Undo: add-iam-policy-binding ... --role=roles/editor for $COMPUTE_SA and/or $APPSPOT_SA"
