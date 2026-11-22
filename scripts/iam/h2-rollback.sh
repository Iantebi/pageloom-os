#!/usr/bin/env bash
# H2 rollback - one section per phase. PRODUCTION-CHANGING: run manually, only with approval.
# Never call this from npm scripts, hooks or CI (CLAUDE.md rule 6).
#
#   phase4  - restore roles/editor on the compute account (fast "undo" if anything breaks after
#             Editor is removed). Run this FIRST in any incident after phase 4.
#   phase3  - functions back to the compute account: redeploy d884ffd (functions + hosting, pinTag).
#             Printed only; the deploy itself needs its own approval.
#   phase2  - undo phase 2 completely: (1) disable the three H2 accounts - takes effect at once and
#             is reversible (`gcloud iam service-accounts enable`); (2) remove every binding
#             h2-grant.sh added, plus the 4 trigger invokers h2-grant-invokers.sh added - both
#             from the same lists (h2-common.sh), so nothing is left behind.
#             Only after phase 3 is rolled back - otherwise the functions using them stop working.
#             The custom role pageloomApiAuth is deliberately KEPT: with no members it grants
#             nothing, and a deleted custom role's ID cannot be reused for ~37 days, which would
#             block re-running h2-grant.sh. The accounts are disabled, not deleted, for the same
#             reason (re-running the grant re-enables nothing by itself - see below).
#
# Dry run by default. Pass --execute as the second argument to run.
# Pre-H2 IAM snapshot: ../pageloom-os-backups/pre-h2-20261119 (SHA256SUMS.txt inside).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/h2-common.sh"

COMPUTE_SA="386075478217-compute@developer.gserviceaccount.com"
PHASE="${1:-}"
[[ "${2:-}" == "--execute" ]] && EXECUTE=true

$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
case "$PHASE" in
  phase4)
    preflight
    run gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$COMPUTE_SA" --role=roles/editor --condition=None
    ;;
  phase3)
    echo "Fast path (~1 min, API only): put Hosting back on version ef8882e3, which re-pins /api/**"
    echo "to api-00105-her (compute account). Old fh-* revision tags are never deleted."
    echo "  firebase hosting:clone pageloom-os-production@ef8882e3aa336ccf pageloom-os-production:live --project $PROJECT"
    echo "Full path (~5-8 min, all functions + trigger identities): redeploy the pre-H2 code."
    echo "  cd ../pageloom-os-h1   # security/h1-only-20261117 = d884ffd, has functions/.env.$PROJECT"
    echo "  firebase deploy --only functions,hosting --project $PROJECT"
    echo "Both are deploys and need their own approval."
    ;;
  phase2)
    preflight
    # 1. Stop the accounts from being usable at all - immediate, reversible.
    for name in "${H2_ACCOUNTS[@]}"; do
      run_tolerant gcloud iam service-accounts disable "${name}@${DOMAIN}" --project="$PROJECT"
    done
    # 2. Remove exactly the bindings phase 2 / 2b added (same lists as the grants).
    h2_bindings remove
    h2_invokers remove
    echo "Kept on purpose: custom role $H2_CUSTOM_ROLE (no members) and the 3 accounts (disabled)."
    echo "To retry phase 2 later: enable the accounts, then re-run h2-grant.sh."
    ;;
  *)
    echo "usage: $0 phase4|phase3|phase2 [--execute]" >&2; exit 2
    ;;
esac
