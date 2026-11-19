#!/usr/bin/env bash
# H2 rollback - one section per phase. PRODUCTION-CHANGING: run manually, only with approval.
# Never call this from npm scripts, hooks or CI (CLAUDE.md rule 6).
#
#   phase4  - restore roles/editor on the compute account (fast "undo" if anything breaks after
#             Editor is removed). Run this FIRST in any incident after phase 4.
#   phase3  - functions back to the compute account: redeploy d884ffd (functions + hosting, pinTag).
#             Printed only; the deploy itself needs its own approval.
#   phase2  - disable the three H2 accounts (reversible with `gcloud iam service-accounts enable`).
#             Only after phase 3 is rolled back - otherwise the functions using them stop working.
#
# Dry run by default. Pass --execute as the second argument to run.
# Pre-H2 IAM snapshot: ../pageloom-os-backups/pre-h2-20261119 (SHA256SUMS.txt inside).
set -euo pipefail

PROJECT="pageloom-os-production"
COMPUTE_SA="386075478217-compute@developer.gserviceaccount.com"
DOMAIN="${PROJECT}.iam.gserviceaccount.com"
PHASE="${1:-}"
EXECUTE=false
[[ "${2:-}" == "--execute" ]] && EXECUTE=true
run() { echo "+ $*"; if $EXECUTE; then "$@" >/dev/null; fi; }

$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
case "$PHASE" in
  phase4)
    run gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$COMPUTE_SA" --role=roles/editor --condition=None
    ;;
  phase3)
    echo "Redeploy the pre-H2 code (functions back on the compute account). Needs its own approval:"
    echo "  cd ../pageloom-os-h1 && git checkout d884ffd"
    echo "  firebase deploy --only functions,hosting --project $PROJECT"
    ;;
  phase2)
    for name in pageloom-api pageloom-agents pageloom-workers; do
      run gcloud iam service-accounts disable "${name}@${DOMAIN}" --project="$PROJECT"
    done
    # Soft delete (restorable for 7 days with `gcloud iam roles undelete`).
    run gcloud iam roles delete pageloomApiAuth --project="$PROJECT"
    ;;
  *)
    echo "usage: $0 phase4|phase3|phase2 [--execute]" >&2; exit 2
    ;;
esac
