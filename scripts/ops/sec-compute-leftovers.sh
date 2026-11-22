#!/usr/bin/env bash
# Least privilege - remove what the default compute account no longer needs after H2 + Editor removal.
# Today (2026-11-19) every function runs as an H2 account, every Eventarc trigger delivers as
# pageloom-agents / pageloom-workers, and every Scheduler job invokes as pageloom-workers /
# pageloom-backup. The compute account is only Cloud Build's identity (cloudbuild.builds.builder).
# Leftovers removed here:
#   - project roles/run.invoker            (was the Eventarc/Scheduler identity before H2)
#   - project roles/eventarc.eventReceiver (same)
#   - roles/secretmanager.secretAccessor on all 19 secrets (was the runtime identity before H2)
# Guard: aborts if anything still uses the compute account as a runtime/trigger/scheduler identity.
# Note: a future `firebase deploy` that introduces a brand-new trigger TYPE may re-grant the two
# project roles to compute (firebase-tools ensureServiceAgentRoles) - re-run this script after it.
# PRODUCTION-CHANGING (IAM). Approval: APPROVE PRODUCTION IAM: REMOVE COMPUTE LEFTOVERS
# Dry run by default; --execute to apply. Undo: the matching add-iam-policy-binding commands.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../iam/h2-common.sh"
COMPUTE_SA="386075478217-compute@developer.gserviceaccount.com"
[[ "${1:-}" == "--execute" ]] && EXECUTE=true
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight
if $EXECUTE; then
  uses=0
  uses=$((uses + $(gcloud functions list --project="$PROJECT" --format='value(serviceConfig.serviceAccountEmail)' | grep -c "$COMPUTE_SA" || true)))
  for l in eur3 europe-west1; do uses=$((uses + $(gcloud eventarc triggers list --location=$l --project="$PROJECT" --format='value(serviceAccount)' 2>/dev/null | grep -c "$COMPUTE_SA" || true))); done
  uses=$((uses + $(gcloud scheduler jobs list --location="$REGION" --project="$PROJECT" --format='value(httpTarget.oidcToken.serviceAccountEmail)' | grep -c "$COMPUTE_SA" || true)))
  [[ "$uses" == 0 ]] || { echo "ABORT: compute is still used by $uses runtime/trigger/scheduler identity(ies)" >&2; exit 1; }
  echo "guard OK - compute is not a runtime, trigger or scheduler identity"
fi
run gcloud projects remove-iam-policy-binding "$PROJECT" --member="serviceAccount:$COMPUTE_SA" --role=roles/run.invoker --condition=None
run gcloud projects remove-iam-policy-binding "$PROJECT" --member="serviceAccount:$COMPUTE_SA" --role=roles/eventarc.eventReceiver --condition=None
for s in "${SECRETS[@]}"; do
  run gcloud secrets remove-iam-policy-binding "$s" --project="$PROJECT" --member="serviceAccount:$COMPUTE_SA" --role=roles/secretmanager.secretAccessor
done
