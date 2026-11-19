#!/usr/bin/env bash
# H2 phase 2 - create the three least-privilege runtime service accounts and grant their roles.
#
# PRODUCTION-CHANGING (IAM). Run manually, only after a fresh, explicit approval:
#   APPROVE PRODUCTION IAM: CREATE H2 SERVICE ACCOUNTS
# Never call this from npm scripts, hooks or CI (CLAUDE.md rule 6).
#
# Purely additive: nothing uses these accounts until the phase 3 deploy, and nothing is removed.
# Dry run by default - prints every command. Pass --execute to actually run them.
# The binding list itself lives in h2-common.sh (shared with the rollback).
# Undo: scripts/iam/h2-rollback.sh phase2
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/h2-common.sh"

[[ "${1:-}" == "--execute" ]] && EXECUTE=true
$EXECUTE || echo "### DRY RUN - nothing is changed. Re-run with --execute after approval. ###"
preflight

# Display names and descriptions are Hebrew (IDs stay English). GCP limits: displayName <= 100
# UTF-8 bytes, description <= 256 UTF-8 bytes (Hebrew = 2 bytes/letter) - guarded by
# service-accounts.test.ts. This file must stay UTF-8.
# Idempotent creation, so a re-run after a partial failure does not stop at "already exists".
# An existing account only gets its display name/description refreshed - never its permissions.
create_sa() {
  if $EXECUTE && gcloud iam service-accounts describe "$1@${DOMAIN}" --project="$PROJECT" >/dev/null 2>&1; then
    echo "= $1 already exists - refreshing display name/description only"
    run gcloud iam service-accounts update "$1@${DOMAIN}" --project="$PROJECT" --display-name="$2" --description="$3"
    return
  fi
  run gcloud iam service-accounts create "$1" --project="$PROJECT" --display-name="$2" --description="$3"
}

# 1. Accounts
create_sa pageloom-api "PageLoom · ממשק ה-API הציבורי" \
  "חשבון ההרצה של פונקציית api. גישה למסד Firestore הראשי בלבד, ניהול משתמשים מצומצם, קבצים בדלי הראשי וסודות ההרצה. ללא Editor. (H2)"
create_sa pageloom-agents "PageLoom · סוכני AI" \
  "חשבון ההרצה של executeAgentTask. גישה למסד Firestore הראשי בלבד, קבצים בדלי הראשי וסודות ההרצה. ללא Cloud Run ו-Cloud Build. (H2)"
create_sa pageloom-workers "PageLoom · תהליכי רקע ותזמונים" \
  "חשבון ההרצה של טריגרי ה-workflow והמשימות המתוזמנות. גישה למסד Firestore הראשי בלבד וצפייה בגיבויים. ללא סודות. (H2)"

# 1b. Custom Auth role for api - only what the code calls (functions/src, 2026-11-19):
#   verifyIdToken(checkRevoked) -> users.get ; updateUser, revokeRefreshTokens -> users.update ;
#   generatePasswordResetLink -> users.sendEmail.
# Deliberately NOT roles/firebaseauth.admin, which also allows users.delete and Auth config
# changes (configs.update - e.g. MFA, authorized domains) and reading configs.getSecret/getHashConfig.
if $EXECUTE && gcloud iam roles describe "$H2_CUSTOM_ROLE" --project="$PROJECT" >/dev/null 2>&1; then
  echo "= role $H2_CUSTOM_ROLE already exists, skipping create"
else
  run gcloud iam roles create "$H2_CUSTOM_ROLE" --project="$PROJECT" --title="PageLoom API Auth (H2)" \
    --description="Least-privilege Firebase Auth access for the api function" --stage=GA \
    --permissions=firebaseauth.users.get,firebaseauth.users.update,firebaseauth.users.sendEmail
fi

# 2-5. Bindings (api, agents, workers, secrets) - defined once in h2-common.sh.
h2_bindings add

$EXECUTE && echo "Done. Verify with: gcloud projects get-iam-policy $PROJECT" || echo "### END DRY RUN ###"
