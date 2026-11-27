#!/usr/bin/env bash
# Protection against accidental deletion of the Firebase/GCP project, plus an independent backup copy
# OUTSIDE the project. Stages, each run separately and each with its own approval:
#
#   status : read-only. Liens on the project, Firestore delete protection / PITR, backup-bucket
#            retention + soft delete + versioning, and whether the vault exists and is protected.
#   lien   : adds a project lien that blocks `projects delete` until someone deliberately removes the
#            lien (needs resourcemanager.liens.delete). Free. Reversible (rollback-lien).
#            Approval: APPROVE PRODUCTION PROTECTION: PROJECT LIEN
#   vault  : creates a SEPARATE project ($VAULT_PROJECT) with its own lien, an EU bucket with a
#            retention policy (objects cannot be deleted or replaced before VAULT_RETENTION_DAYS, by
#            anyone, even an owner) and a daily Storage Transfer job copying the Firestore exports
#            from the production backup bucket into it. Deleting the production project then no
#            longer deletes every backup. Creates a project and links billing (cost: cents/month).
#            The only production change is a READ grant for the transfer service on the backup bucket.
#            Approval: APPROVE PRODUCTION PROTECTION: BACKUP VAULT
#   rollback-lien : removes the lien added by `lien`.
#
# Not covered by this script (stated so nobody over-trusts it): the vault is in the same Google
# account/billing account. Losing the Google account itself is covered only by an offline copy
# (runbook), and a retention policy that is NOT locked can still be removed by an owner on purpose.
#
# Usage: sec-project-protection.sh <stage> [--execute]   (dry run by default; status always runs)
#        vault needs BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/../iam/h2-common.sh"

VAULT_PROJECT="${VAULT_PROJECT:-pageloom-backup-vault}"
VAULT_BUCKET="gs://${VAULT_PROJECT}-firestore"
VAULT_LOCATION="${VAULT_LOCATION:-EU}"
VAULT_RETENTION_DAYS="${VAULT_RETENTION_DAYS:-35}"
VAULT_DELETE_AFTER_DAYS="${VAULT_DELETE_AFTER_DAYS:-120}"
LIEN_ORIGIN="pageloom-protection"
LIEN_REASON="PageLoom production: deleting this project deletes the site backend, data and backups. Remove this lien only with written approval."
STS_API="${STS_API:-https://storagetransfer.googleapis.com/v1}"

MODE="${1:-status}"; [[ "${2:-}" == "--execute" ]] && EXECUTE=true
[[ "$MODE" == status ]] && EXECUTE=true   # read-only stage
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight

# The backup window: the export runs 00:00 UTC; never change protection while it runs.
if [[ "$MODE" != status ]] && $EXECUTE && [[ "$(date -u +%H)" == 00 ]]; then
  echo "ABORT: 00:00-01:00 UTC is the backup window - run later" >&2; exit 1
fi

liens_of() { { gcloud alpha resource-manager liens list --project="$1" --format='value(name,origin)' 2>/dev/null || true; } | tr -d '\r'; }
has_our_lien() { liens_of "$1" | grep -q "$LIEN_ORIGIN"; }
project_exists() { gcloud projects describe "$1" --format='value(projectId)' >/dev/null 2>&1; }

case "$MODE" in
  status)
    echo "== project lien ($PROJECT)"
    if has_our_lien "$PROJECT"; then echo "  OK: lien present"; else echo "  MISSING: no lien - the project can be deleted in one command"; fi
    echo "== Firestore (default)"
    gcloud firestore databases describe --database='(default)' --project="$PROJECT" \
      --format='value(deleteProtectionState,pointInTimeRecoveryEnablement)' | tr -d '\r' | sed 's/^/  /'
    echo "== backup bucket $BACKUP_BUCKET"
    gcloud storage buckets describe "$BACKUP_BUCKET" \
      --format='value(retention_policy.retentionPeriod,retention_policy.isLocked,soft_delete_policy.retentionDurationSeconds,versioning_enabled)' | tr -d '\r' | sed 's/^/  retention(s) locked softDelete(s) versioning: /'
    echo "== vault $VAULT_PROJECT"
    if project_exists "$VAULT_PROJECT"; then
      has_our_lien "$VAULT_PROJECT" && echo "  OK: vault lien present" || echo "  MISSING: vault has no lien"
      gcloud storage buckets describe "$VAULT_BUCKET" --format='value(retention_policy.retentionPeriod)' 2>/dev/null | sed 's/^/  vault retention(s): /' || echo "  MISSING: vault bucket"
    else
      echo "  MISSING: no vault - every backup lives inside $PROJECT"
    fi ;;

  lien)
    if $EXECUTE && has_our_lien "$PROJECT"; then echo "lien already present - nothing to do"; exit 0; fi
    run gcloud alpha resource-manager liens create --project="$PROJECT" \
      --restrictions=resourcemanager.projects.delete --origin="$LIEN_ORIGIN" --reason="$LIEN_REASON"
    if $EXECUTE; then has_our_lien "$PROJECT" || { echo "FAIL: lien not visible after create" >&2; exit 1; }; echo "PASS: lien present"; fi ;;

  rollback-lien)
    name="$(liens_of "$PROJECT" | awk -v o="$LIEN_ORIGIN" '$2==o{print $1; exit}')"
    if $EXECUTE && [[ -z "$name" ]]; then echo "no lien of ours - nothing to remove"; exit 0; fi
    run gcloud alpha resource-manager liens delete "${name:-<lien-name>}" ;;

  vault)
    [[ -n "${BILLING_ACCOUNT:-}" ]] || { echo "ABORT: set BILLING_ACCOUNT (the account $PROJECT already uses)" >&2; exit 1; }
    [[ "$VAULT_PROJECT" != "$PROJECT" ]] || { echo "ABORT: the vault must be a different project" >&2; exit 1; }
    (( VAULT_DELETE_AFTER_DAYS > VAULT_RETENTION_DAYS )) || { echo "ABORT: lifecycle delete must be later than retention" >&2; exit 1; }
    if $EXECUTE && project_exists "$VAULT_PROJECT"; then echo "ABORT: $VAULT_PROJECT already exists - check it with status first" >&2; exit 1; fi
    run gcloud projects create "$VAULT_PROJECT" --name="PageLoom backup vault"
    run gcloud billing projects link "$VAULT_PROJECT" --billing-account="$BILLING_ACCOUNT"
    run gcloud services enable storagetransfer.googleapis.com storage.googleapis.com --project="$VAULT_PROJECT"
    run gcloud alpha resource-manager liens create --project="$VAULT_PROJECT" \
      --restrictions=resourcemanager.projects.delete --origin="$LIEN_ORIGIN" --reason="PageLoom backup vault - holds the off-project copy of production backups."
    run gcloud storage buckets create "$VAULT_BUCKET" --project="$VAULT_PROJECT" --location="$VAULT_LOCATION" \
      --uniform-bucket-level-access --public-access-prevention --retention-period="${VAULT_RETENTION_DAYS}d"
    lifecycle="$(mktemp)"; trap 'rm -f "$lifecycle"' EXIT
    printf '{"rule":[{"action":{"type":"Delete"},"condition":{"age":%d}}]}\n' "$VAULT_DELETE_AFTER_DAYS" > "$lifecycle"
    run gcloud storage buckets update "$VAULT_BUCKET" --lifecycle-file="$lifecycle"
    # The transfer runs as Google's per-project Storage Transfer service agent of the VAULT project.
    if $EXECUTE; then
      STS_SA="$(curl -fsS -H "Authorization: Bearer $(gcloud auth print-access-token | tr -d '\r')" "$STS_API/googleServiceAccounts/$VAULT_PROJECT" | sed -n 's/.*"accountEmail": *"\([^"]*\)".*/\1/p')"
      [[ "$STS_SA" == *@storage-transfer-service.iam.gserviceaccount.com ]] || { echo "ABORT: could not resolve the transfer service account" >&2; exit 1; }
    else STS_SA="project-<VAULT_NUMBER>@storage-transfer-service.iam.gserviceaccount.com"; fi
    # Production change, READ only: the transfer may list/read the production backup bucket.
    run gcloud storage buckets add-iam-policy-binding "$BACKUP_BUCKET" --member="serviceAccount:$STS_SA" --role=roles/storage.objectViewer
    run gcloud storage buckets add-iam-policy-binding "$BACKUP_BUCKET" --member="serviceAccount:$STS_SA" --role=roles/storage.legacyBucketReader
    run gcloud storage buckets add-iam-policy-binding "$VAULT_BUCKET" --member="serviceAccount:$STS_SA" --role=roles/storage.objectAdmin
    # Copy only Firestore exports; never delete in the vault because the source deleted something.
    run gcloud transfer jobs create "$BACKUP_BUCKET/firestore/" "$VAULT_BUCKET/firestore/" --project="$VAULT_PROJECT" \
      --name="transferJobs/pageloom-daily-vault-copy" --description="Daily copy of production Firestore exports" \
      --schedule-repeats-every=1d --schedule-starts="$(date -u -d 'tomorrow 03:30' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u +%Y-%m-%dT03:30:00Z)" \
      --overwrite-when=never
    echo "After the first scheduled run: compare object counts of the newest export folder in both buckets." ;;

  *) echo "usage: $0 status | lien | rollback-lien | vault  [--execute]" >&2; exit 2 ;;
esac
