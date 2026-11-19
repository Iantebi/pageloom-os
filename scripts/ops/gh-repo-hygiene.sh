#!/usr/bin/env bash
# GitHub hygiene for the PUBLIC repo Iantebi/pageloom-os (visibility is NOT changed).
#   - enable Dependabot vulnerability alerts (currently disabled)
#   - disable the "Autonomous Development Manager" workflow (cron every 30 min on the retired OS
#     backlog). Re-enable with `gh workflow enable`.
#   - restrict which Actions may run: GitHub-owned + verified creators + anthropics/* only
#     (currently "all"). Workflows are also SHA-pinned on branch security/github-hardening-20261119.
# GITHUB-CHANGING. Approval: APPROVE GITHUB: REPO HYGIENE
# Dry run by default; --execute to apply. Undo: allowed_actions=all, `gh workflow enable`, DELETE vulnerability-alerts.
set -euo pipefail
REPO="Iantebi/pageloom-os"; EXECUTE=false; [[ "${1:-}" == "--execute" ]] && EXECUTE=true
run() { echo "+ $*"; if $EXECUTE; then "$@"; fi; }
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
run gh api -X PUT "repos/$REPO/vulnerability-alerts"
run gh workflow disable "Autonomous Development Manager" -R "$REPO"
run gh api -X PUT "repos/$REPO/actions/permissions" -F enabled=true -f allowed_actions=selected
run gh api -X PUT "repos/$REPO/actions/permissions/selected-actions" -F github_owned_allowed=true -F verified_allowed=true -f 'patterns_allowed[]=anthropics/*'
