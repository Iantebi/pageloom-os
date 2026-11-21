#!/usr/bin/env bash
# Security fix A7 - Uniform bucket-level access + enforced public access prevention on the main
# Storage bucket, so access is governed only by IAM + Firebase Storage rules (no per-object ACLs).
# Firebase download tokens and Storage rules keep working. A sample of objects had no public ACL.
# PRODUCTION-CHANGING. Approval: APPROVE PRODUCTION: STORAGE UNIFORM ACCESS
# Dry run by default; --execute to apply. Undo (UBLA only, within 90 days): --no-uniform-bucket-level-access
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../iam/h2-common.sh"
[[ "${1:-}" == "--execute" ]] && EXECUTE=true
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight
if $EXECUTE; then
  pub="$(gcloud storage ls -r "$MAIN_BUCKET/**" 2>/dev/null | head -200 | while read -r o; do gcloud storage objects describe "$o" --format='value(acl)' 2>/dev/null | grep -c allUsers; done | awk '{s+=$1} END {print s+0}')"
  [[ "$pub" == 0 ]] || { echo "ABORT: $pub object(s) have a public ACL - review before enforcing" >&2; exit 1; }
fi
run gcloud storage buckets update "$MAIN_BUCKET" --uniform-bucket-level-access --public-access-prevention
