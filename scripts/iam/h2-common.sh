#!/usr/bin/env bash
# Shared by h2-grant.sh and h2-rollback.sh - sourced, never run on its own.
#
# The H2 binding list lives ONLY here, so the rollback always removes exactly what the grant
# added and the two can never drift apart. h2_bindings add|remove applies every binding.
# This file must stay UTF-8 + LF (see .gitattributes; guarded by service-accounts.test.ts).

PROJECT="pageloom-os-production"
DOMAIN="${PROJECT}.iam.gserviceaccount.com"
API_SA="pageloom-api@${DOMAIN}"
AGENTS_SA="pageloom-agents@${DOMAIN}"
WORKERS_SA="pageloom-workers@${DOMAIN}"
H2_ACCOUNTS=(pageloom-api pageloom-agents pageloom-workers)
H2_CUSTOM_ROLE="pageloomApiAuth"
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

# Firestore access limited to the main (default) database by an IAM condition (documented form:
# Firestore "Configure per-database access permissions"). Without it, datastore.user is
# project-wide and would also reach the C1/C2 AI Studio databases and the restore-drill database
# (the Admin SDK bypasses security rules). Functions only use getFirestore().
DEFAULT_DB_CONDITION="expression=resource.name==\"projects/${PROJECT}/databases/(default)\",title=default-db-only,description=H2: main Firestore database only"

# gcloud's Python here defaults to cp1252 console output; force UTF-8 so Hebrew cannot crash it.
export PYTHONIOENCODING=utf-8
# On this machine `gcloud` cannot find Python by itself ("Python was not found"). Use the SDK's
# bundled interpreter when the caller has not set one.
if [[ -z "${CLOUDSDK_PYTHON:-}" ]] && command -v gcloud >/dev/null 2>&1; then
  _sdk_python="$(dirname "$(command -v gcloud)")/../platform/bundledpython/python.exe"
  [[ -x "$_sdk_python" ]] && export CLOUDSDK_PYTHON="$_sdk_python"
fi

EXECUTE=false
run() { echo "+ $*"; if $EXECUTE; then "$@" >/dev/null; fi; }
# Removal is best-effort: a binding that is already gone must not abort the rest of the rollback.
run_tolerant() { echo "+ $*"; if $EXECUTE; then "$@" >/dev/null 2>&1 || echo "  ! not removed (already absent?) - continuing"; fi; }

# Read-only checks before any real change: gcloud works, someone is signed in, project reachable.
preflight() {
  $EXECUTE || return 0
  gcloud --version >/dev/null 2>&1 || { echo "ABORT: gcloud does not run (set CLOUDSDK_PYTHON?)" >&2; exit 1; }
  local account; account="$(gcloud config get-value account 2>/dev/null | tr -d '\r')"
  [[ -n "$account" ]] || { echo "ABORT: no active gcloud account" >&2; exit 1; }
  gcloud projects describe "$PROJECT" --format="value(projectId)" >/dev/null 2>&1 || { echo "ABORT: cannot read project $PROJECT" >&2; exit 1; }
  echo "preflight OK - project $PROJECT, account $account"
}

# Every H2 binding. $1 = add | remove.
h2_bindings() {
  local verb="$1" exec_fn
  case "$verb" in add) exec_fn=run ;; remove) exec_fn=run_tolerant ;; *) echo "h2_bindings: add|remove" >&2; exit 2 ;; esac
  local project_cmd=(gcloud projects "${verb}-iam-policy-binding" "$PROJECT")
  local bucket_cmd=(gcloud storage buckets "${verb}-iam-policy-binding")
  project_role() { $exec_fn "${project_cmd[@]}" --member="serviceAccount:$1" --role="$2" --condition=None; }
  firestore_role() { $exec_fn "${project_cmd[@]}" --member="serviceAccount:$1" --role=roles/datastore.user --condition="$DEFAULT_DB_CONDITION"; }
  bucket_role() { $exec_fn "${bucket_cmd[@]}" "$1" --member="serviceAccount:$2" --role="$3"; }

  # api - public HTTP function: main Firestore DB, narrow Auth, main-bucket objects (no ACL
  # control), signing its own URLs, secrets, logs.
  firestore_role "$API_SA"
  project_role "$API_SA" "projects/${PROJECT}/roles/${H2_CUSTOM_ROLE}"
  project_role "$API_SA" roles/logging.logWriter
  bucket_role "$MAIN_BUCKET" "$API_SA" roles/storage.objectUser
  $exec_fn gcloud iam service-accounts "${verb}-iam-policy-binding" "$API_SA" --project="$PROJECT" \
    --member="serviceAccount:$API_SA" --role=roles/iam.serviceAccountTokenCreator  # getSignedUrl -> signBlob on itself

  # agents - executeAgentTask (Firestore trigger): Firestore, main-bucket artifacts, secrets, logs.
  # Option A (approved 2026-11-19): NO Cloud Run / Cloud Build roles - the agents' `gcp` tool
  # (cloud_run_deploy, cloud_build) fails closed instead of running with Editor.
  firestore_role "$AGENTS_SA"
  project_role "$AGENTS_SA" roles/eventarc.eventReceiver
  project_role "$AGENTS_SA" roles/logging.logWriter
  bucket_role "$MAIN_BUCKET" "$AGENTS_SA" roles/storage.objectUser

  # workers - workflow triggers + schedules: main Firestore DB only, plus the backup watchdog's
  # read-only checks (backup bucket listing, Storage Transfer operations, Service Health). No secrets.
  firestore_role "$WORKERS_SA"
  project_role "$WORKERS_SA" roles/eventarc.eventReceiver
  project_role "$WORKERS_SA" roles/logging.logWriter
  project_role "$WORKERS_SA" roles/storagetransfer.viewer
  project_role "$WORKERS_SA" roles/servicehealth.viewer
  bucket_role "$BACKUP_BUCKET" "$WORKERS_SA" roles/storage.objectViewer

  # Secrets - api and agents only, one secret at a time.
  local s sa
  for s in "${SECRETS[@]}"; do
    for sa in "$API_SA" "$AGENTS_SA"; do
      $exec_fn gcloud secrets "${verb}-iam-policy-binding" "$s" --project="$PROJECT" --member="serviceAccount:$sa" --role=roles/secretmanager.secretAccessor
    done
  done
}
