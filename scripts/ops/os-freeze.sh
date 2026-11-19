#!/usr/bin/env bash
# PageLoom OS retirement B2 - freeze: pause the OS scheduled jobs. Reversible with `resume`.
# Keeps the backup jobs (dailyFirestoreBackup, backupFreshnessWatchdog) running while the main
# database still holds data. Functions stay deployed (nothing deleted).
# PRODUCTION-CHANGING. Approval: APPROVE PRODUCTION: FREEZE PAGELOOM OS
# Usage: os-freeze.sh [pause|resume] [--execute]   (dry run by default)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../iam/h2-common.sh"
ACTION="${1:-pause}"; [[ "$ACTION" == pause || "$ACTION" == resume ]] || { echo "usage: $0 pause|resume [--execute]" >&2; exit 2; }
[[ "${2:-}" == "--execute" ]] && EXECUTE=true
JOBS=(monitorWorkflowTimeouts recoverAgentQueue monitorBusinessRisks dailyCeoReport)
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight
for j in "${JOBS[@]}"; do
  run gcloud scheduler jobs "$ACTION" "firebase-schedule-${j}-${REGION}" --location="$REGION" --project="$PROJECT"
done
echo "Kept running: dailyFirestoreBackup, backupFreshnessWatchdog."
