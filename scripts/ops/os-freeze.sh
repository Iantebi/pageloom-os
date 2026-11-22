#!/usr/bin/env bash
# PageLoom OS retirement B2 - freeze: pause the 4 OS scheduled jobs and the one alert policy that
# would fire because of it (P9 "monitorBusinessRisks dead-man"). Fully reversible with `resume`.
# Keeps running: dailyFirestoreBackup, backupFreshnessWatchdog, and backup alerts P1/P2/P10.
# Functions stay deployed and the API keeps serving (nothing deleted).
# PRODUCTION-CHANGING. Approval: APPROVE PRODUCTION: FREEZE PAGELOOM OS
# Usage: os-freeze.sh [pause|resume] [--execute]   (dry run by default)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../iam/h2-common.sh"
ACTION="${1:-pause}"; [[ "$ACTION" == pause || "$ACTION" == resume ]] || { echo "usage: $0 pause|resume [--execute]" >&2; exit 2; }
[[ "${2:-}" == "--execute" ]] && EXECUTE=true
JOBS=(monitorWorkflowTimeouts recoverAgentQueue monitorBusinessRisks dailyCeoReport)
DEADMAN_ALERT="PageLoom P9 - monitorBusinessRisks dead-man"
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight
for j in "${JOBS[@]}"; do
  run gcloud scheduler jobs "$ACTION" "firebase-schedule-${j}-${REGION}" --location="$REGION" --project="$PROJECT"
done
enabled=$([[ "$ACTION" == pause ]] && echo false || echo true)
echo "+ set alert policy '$DEADMAN_ALERT' enabled=$enabled"
if $EXECUTE; then
  TOKEN="$(gcloud auth print-access-token)" PROJECT="$PROJECT" NAME="$DEADMAN_ALERT" EN="$enabled" node -e '
  const P=process.env.PROJECT,H={Authorization:"Bearer "+process.env.TOKEN,"x-goog-user-project":P,"Content-Type":"application/json"};
  (async()=>{const l=await (await fetch(`https://monitoring.googleapis.com/v3/projects/${P}/alertPolicies?pageSize=50`,{headers:H})).json();
   const p=(l.alertPolicies||[]).find(x=>x.displayName===process.env.NAME);if(!p){console.error("alert policy not found");process.exit(1)}
   const r=await fetch(`https://monitoring.googleapis.com/v3/${p.name}?updateMask=enabled`,{method:"PATCH",headers:H,body:JSON.stringify({enabled:process.env.EN==="true"})});
   console.log("  alert",r.ok?"updated":"FAILED "+r.status);if(!r.ok)process.exit(1)})()'
fi
echo "Kept running: dailyFirestoreBackup, backupFreshnessWatchdog (and alerts P1, P2, P10)."
