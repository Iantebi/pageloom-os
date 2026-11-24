#!/usr/bin/env bash
# Infrastructure for the Discovery storage gateway (discovery-storage-gateway/, plan of 2026-11-24).
# Creates nothing by itself: DRY RUN by default, each stage needs --execute AND the owner's approval.
#
#  buckets : pageloom-discovery-files (europe-west1) + pageloom-discovery-files-backup (EU), both with
#            uniform bucket-level access, public access prevention ENFORCED and 30-day soft delete.
#            Dedicated buckets on purpose: the default Firebase bucket is mirrored by the media Storage
#            Transfer job and has fine-grained ACLs; the backups bucket belongs to the Firestore exports.
#  account : service account discovery-storage-gw (no key) with objectCreator + objectViewer on those
#            two buckets ONLY. objectCreator cannot delete, so no object can be overwritten or removed.
#  secret  : Secret Manager secret DISCOVERY_GATEWAY_SECRET (48 random bytes = 64 base64 chars, no CR/LF -
#            Windows openssl ends lines with CR, which broke version 1 on 2026-11-24; generated here, never
#            printed) + secretAccessor for the gateway account. The same value then goes into the
#            Base44 app's secrets BY THE OWNER (Google Cloud console -> copy -> Base44 secrets);
#            it must never pass through chat, logs or the repository.
#  verify  : read-only proof: bucket settings, exact IAM bindings, anonymous access refused.
#  rollback: removes the IAM grants and disables the secret versions. Buckets and their objects are
#            NEVER deleted by this script (deleting data needs its own, separate approval).
#
# PRODUCTION-CHANGING. Approval per stage, e.g.: APPROVE PRODUCTION DEPLOY: DISCOVERY STORAGE INFRA
# The gateway function itself is deployed separately:
#   firebase deploy --only functions:discovery-gateway --project pageloom-os-production
# Usage: sec-discovery-storage-setup.sh buckets|account|secret|rollback [--execute]
#        sec-discovery-storage-setup.sh verify            (read-only, always runs)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/../iam/h2-common.sh"

FILES_BUCKET="gs://pageloom-discovery-files"
BACKUP_BUCKET_D="gs://pageloom-discovery-files-backup"
GW_NAME="discovery-storage-gw"
GW_SA="${GW_NAME}@${DOMAIN}"
SECRET="DISCOVERY_GATEWAY_SECRET"
ROLES=(roles/storage.objectCreator roles/storage.objectViewer)

MODE="${1:-}"; ARG="${2:-}"; [[ "$ARG" == "--execute" ]] && EXECUTE=true
[[ "$MODE" == verify ]] && EXECUTE=true   # read-only
[[ -n "$MODE" ]] || { echo "usage: $0 buckets|account|secret|verify|rollback [--execute]" >&2; exit 2; }
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight

bucket_exists() { gcloud storage buckets describe "$1" --format="value(name)" >/dev/null 2>&1; }

case "$MODE" in
  buckets)
    for spec in "$FILES_BUCKET:europe-west1" "$BACKUP_BUCKET_D:EU"; do
      b="${spec%:*}"; loc="${spec##*:}"   # split at the LAST colon (the name itself contains gs://)
      if $EXECUTE && bucket_exists "$b"; then echo "= $b already exists - left as is (check with: $0 verify)"; continue; fi
      run gcloud storage buckets create "$b" --project="$PROJECT" --location="$loc" \
        --default-storage-class=STANDARD --uniform-bucket-level-access \
        --public-access-prevention --soft-delete-duration=30d
    done
    ;;
  account)
    if $EXECUTE && gcloud iam service-accounts describe "$GW_SA" --project="$PROJECT" >/dev/null 2>&1; then
      echo "= $GW_SA already exists"
    else
      run gcloud iam service-accounts create "$GW_NAME" --project="$PROJECT" \
        --display-name="Discovery storage gateway" \
        --description="Runs discoveryStorageGateway. Object create/view on the two discovery buckets only. No keys."
    fi
    for b in "$FILES_BUCKET" "$BACKUP_BUCKET_D"; do
      for role in "${ROLES[@]}"; do
        run gcloud storage buckets add-iam-policy-binding "$b" --member="serviceAccount:$GW_SA" --role="$role"
      done
    done
    ;;
  secret)
    if $EXECUTE && gcloud secrets describe "$SECRET" --project="$PROJECT" >/dev/null 2>&1; then
      echo "= secret $SECRET already exists - no new version added (rotate deliberately, not by re-running)"
    else
      run gcloud secrets create "$SECRET" --project="$PROJECT" --replication-policy=user-managed --locations=europe-west1
      echo "+ (48 random bytes) | gcloud secrets versions add $SECRET --data-file=-   [value never printed]"
      if $EXECUTE; then openssl rand -base64 48 | tr -d '\r\n' | gcloud secrets versions add "$SECRET" --project="$PROJECT" --data-file=- >/dev/null; fi
    fi
    run gcloud secrets add-iam-policy-binding "$SECRET" --project="$PROJECT" --member="serviceAccount:$GW_SA" --role=roles/secretmanager.secretAccessor
    echo "NEXT (owner, by hand): copy the secret value from the Google Cloud console into the Base44"
    echo "app secret DISCOVERY_GATEWAY_SECRET. Do not paste it anywhere else."
    ;;
  verify)
    fail=0
    for b in "$FILES_BUCKET" "$BACKUP_BUCKET_D"; do
      echo "-- $b"
      if ! bucket_exists "$b"; then echo "  MISSING"; fail=1; continue; fi
      gcloud storage buckets describe "$b" --format="value(location,public_access_prevention,uniform_bucket_level_access,soft_delete_policy.retentionDurationSeconds)"
      pap="$(gcloud storage buckets describe "$b" --format="value(public_access_prevention)" | tr -d '\r')"
      [[ "$pap" == "enforced" ]] || { echo "  FAIL: public access prevention is '$pap'"; fail=1; }
      members="$(gcloud storage buckets get-iam-policy "$b" --format=json | tr -d '\r')"
      grep -q "allUsers\|allAuthenticatedUsers" <<<"$members" && { echo "  FAIL: public member in IAM"; fail=1; }
      for role in "${ROLES[@]}"; do grep -q "\"$role\"" <<<"$members" || { echo "  FAIL: $role missing"; fail=1; }; done
      grep -q "objectAdmin\|storage.admin\"" <<<"$members" && echo "  NOTE: an admin-level role exists on this bucket (review)"
      code="$(curl -s -o /dev/null -w '%{http_code}' "https://storage.googleapis.com/storage/v1/b/${b#gs://}/o")"
      [[ "$code" == 401 || "$code" == 403 ]] && echo "  anonymous list refused ($code)" || { echo "  FAIL: anonymous list returned $code"; fail=1; }
    done
    gcloud iam service-accounts keys list --iam-account="$GW_SA" --managed-by=user --project="$PROJECT" --format="value(name)" 2>/dev/null | grep -q . && { echo "FAIL: $GW_SA has a user-managed key"; fail=1; }
    exit "$fail"
    ;;
  rollback)
    for b in "$FILES_BUCKET" "$BACKUP_BUCKET_D"; do
      for role in "${ROLES[@]}"; do
        run_tolerant gcloud storage buckets remove-iam-policy-binding "$b" --member="serviceAccount:$GW_SA" --role="$role"
      done
    done
    run_tolerant gcloud secrets remove-iam-policy-binding "$SECRET" --project="$PROJECT" --member="serviceAccount:$GW_SA" --role=roles/secretmanager.secretAccessor
    echo "+ disable every enabled version of $SECRET"
    if $EXECUTE; then
      for v in $(gcloud secrets versions list "$SECRET" --project="$PROJECT" --filter="state=ENABLED" --format="value(name)" 2>/dev/null); do
        gcloud secrets versions disable "$v" --secret="$SECRET" --project="$PROJECT" >/dev/null || true
      done
    fi
    echo "Buckets and objects are kept on purpose. Deleting them needs a separate, explicit approval."
    ;;
  *) echo "unknown stage: $MODE" >&2; exit 2 ;;
esac
