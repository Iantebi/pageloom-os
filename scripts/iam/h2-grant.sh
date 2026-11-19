#!/usr/bin/env bash
# H2 phase 2 - create the three least-privilege runtime service accounts and grant their roles.
#
# PRODUCTION-CHANGING (IAM). Run manually, only after a fresh, explicit approval:
#   APPROVE PRODUCTION IAM: CREATE H2 SERVICE ACCOUNTS
# Never call this from npm scripts, hooks or CI (CLAUDE.md rule 6).
#
# Purely additive: nothing uses these accounts until the phase 3 deploy, and nothing is removed.
# Dry run by default - prints every command. Pass --execute to actually run them.
# Undo: scripts/iam/h2-rollback.sh phase2
set -euo pipefail

PROJECT="pageloom-os-production"
DOMAIN="${PROJECT}.iam.gserviceaccount.com"
API_SA="pageloom-api@${DOMAIN}"
AGENTS_SA="pageloom-agents@${DOMAIN}"
WORKERS_SA="pageloom-workers@${DOMAIN}"
MAIN_BUCKET="gs://pageloom-os-production.firebasestorage.app"
BACKUP_BUCKET="gs://pageloom-os-production-backups"

# All 19 runtime secrets (functions/src/config.ts `secrets`). api runs tool-gateway after approvals,
# so api and agents both need every one; workers need none. Narrowing is H2 phase 5.
SECRETS=(
  OPENAI_API_KEY GEMINI_API_KEY GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON GOOGLE_WORKSPACE_SUBJECT
  GOOGLE_MAPS_API_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET PAYPAL_CLIENT_ID PAYPAL_CLIENT_SECRET
  WHATSAPP_ACCESS_TOKEN WHATSAPP_PHONE_NUMBER_ID CRM_API_TOKEN ZAPIER_WEBHOOK_SECRET
  MAKE_WEBHOOK_SECRET N8N_API_KEY GITHUB_TOKEN RESEND_API_KEY TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN
)

EXECUTE=false
[[ "${1:-}" == "--execute" ]] && EXECUTE=true
run() { echo "+ $*"; if $EXECUTE; then "$@" >/dev/null; fi; }
project_role() { run gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$1" --role="$2" --condition=None; }
bucket_role() { run gcloud storage buckets add-iam-policy-binding "$1" --member="serviceAccount:$2" --role="$3"; }

$EXECUTE || echo "### DRY RUN - nothing is changed. Re-run with --execute after approval. ###"

# 1. Accounts
run gcloud iam service-accounts create pageloom-api --project="$PROJECT" --display-name="PageLoom API runtime (H2)"
run gcloud iam service-accounts create pageloom-agents --project="$PROJECT" --display-name="PageLoom AI agents runtime (H2)"
run gcloud iam service-accounts create pageloom-workers --project="$PROJECT" --display-name="PageLoom workflow/scheduled workers runtime (H2)"

# 2. api - public HTTP function: Firestore, Auth admin (users, claims, revocation checks),
#    main-bucket objects, signing its own URLs, secrets, logs.
project_role "$API_SA" roles/datastore.user
project_role "$API_SA" roles/firebaseauth.admin
project_role "$API_SA" roles/logging.logWriter
bucket_role "$MAIN_BUCKET" "$API_SA" roles/storage.objectAdmin
run gcloud iam service-accounts add-iam-policy-binding "$API_SA" --project="$PROJECT" \
  --member="serviceAccount:$API_SA" --role=roles/iam.serviceAccountTokenCreator  # getSignedUrl -> signBlob on itself

# 3. agents - executeAgentTask (Firestore trigger): Firestore, main-bucket artifacts, secrets, logs.
#    Option A (approved 2026-11-19): NO Cloud Run / Cloud Build roles - the agents' `gcp` tool
#    (cloud_run_deploy, cloud_build) fails closed instead of running with Editor.
project_role "$AGENTS_SA" roles/datastore.user
project_role "$AGENTS_SA" roles/eventarc.eventReceiver
project_role "$AGENTS_SA" roles/logging.logWriter
bucket_role "$MAIN_BUCKET" "$AGENTS_SA" roles/storage.objectAdmin

# 4. workers - workflow triggers + schedules: Firestore only, plus the backup watchdog's read-only
#    checks (backup bucket listing, Storage Transfer operations, Service Health events). No secrets.
project_role "$WORKERS_SA" roles/datastore.user
project_role "$WORKERS_SA" roles/eventarc.eventReceiver
project_role "$WORKERS_SA" roles/logging.logWriter
project_role "$WORKERS_SA" roles/storagetransfer.viewer
project_role "$WORKERS_SA" roles/servicehealth.viewer
bucket_role "$BACKUP_BUCKET" "$WORKERS_SA" roles/storage.objectViewer

# 5. Secrets - api and agents only.
for s in "${SECRETS[@]}"; do
  for sa in "$API_SA" "$AGENTS_SA"; do
    run gcloud secrets add-iam-policy-binding "$s" --project="$PROJECT" --member="serviceAccount:$sa" --role=roles/secretmanager.secretAccessor
  done
done

$EXECUTE && echo "Done. Verify with: gcloud projects get-iam-policy $PROJECT" || echo "### END DRY RUN ###"
