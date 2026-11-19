#!/usr/bin/env bash
# GitHub hygiene for the PUBLIC repo Iantebi/pageloom-os (visibility is NOT changed).
#   - enable Dependabot vulnerability alerts (currently disabled)
#   - disable the "Autonomous Development Manager" workflow (cron every 30 min on the OS backlog;
#     197 runs; no longer needed now that PageLoom OS is being retired). Re-enable with `gh workflow enable`.
# GITHUB-CHANGING. Approval: APPROVE GITHUB: REPO HYGIENE
# Dry run by default; --execute to apply.
set -euo pipefail
REPO="Iantebi/pageloom-os"; EXECUTE=false; [[ "${1:-}" == "--execute" ]] && EXECUTE=true
run() { echo "+ $*"; if $EXECUTE; then "$@"; fi; }
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
run gh api -X PUT "repos/$REPO/vulnerability-alerts"
run gh workflow disable "Autonomous Development Manager" -R "$REPO"
