#!/usr/bin/env bash
# H2 phase 2b - let the Firestore (Eventarc) triggers invoke their Cloud Run services as the new
# accounts. 4 service-level roles/run.invoker bindings, nothing else (list: h2-common.sh,
# H2_EVENT_INVOKERS). Must run BEFORE the phase 3 deploy, or Firestore deliveries 403 after it.
#
# PRODUCTION-CHANGING (IAM). Run manually, only after a fresh, explicit approval:
#   APPROVE PRODUCTION IAM: H2 EVENT TRIGGER INVOKERS
# Never call this from npm scripts, hooks or CI (CLAUDE.md rule 6).
#
# Purely additive and inert until phase 3: today's triggers still deliver as the compute account.
# Dry run by default. Pass --execute to actually run.
# Undo: scripts/iam/h2-rollback.sh phase2 (removes these together with the phase 2 bindings).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/h2-common.sh"

[[ "${1:-}" == "--execute" ]] && EXECUTE=true
$EXECUTE || echo "### DRY RUN - nothing is changed. Re-run with --execute after approval. ###"
preflight

h2_invokers add

$EXECUTE && echo "Done. Verify with: gcloud run services get-iam-policy <service> --region=$REGION --project=$PROJECT" || echo "### END DRY RUN ###"
