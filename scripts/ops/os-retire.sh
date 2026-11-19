#!/usr/bin/env bash
# PageLoom OS retirement - gradual, each phase approved separately. Run os-freeze.sh first.
#
#   export    B1  Export the main Firestore DB (contains personal data: 2 customers, 1 lead, staff
#                 emails) into a NEW dedicated archive bucket: EU, uniform access, public access
#                 prevention, 30-day retention lock, lifecycle delete at 365 days, no service-account
#                 readers. Media is already mirrored in pageloom-os-production-media-backups.
#   remove    B3  Delete the 9 OS functions and disable the OS Hosting site. KEEPS
#                 dailyFirestoreBackup + backupFreshnessWatchdog. Reversible: redeploy from git
#                 (d884ffd / H2 branch) and `firebase hosting:clone <site>@<version> <site>:live`.
#   cleanup   B4  After `remove`: remove the 4 trigger invokers, delete pageloom-api +
#                 pageloom-agents (pageloom-workers stays for the watchdog), disable every version
#                 of the 19 OS secrets (delete later), remove the "PageLoom OS Web" Firebase app
#                 (restorable 30 days). Auth + API keys: sec-auth-after-os.sh, sec-api-keys.sh retire.
#
# PRODUCTION-CHANGING. Approvals:
#   APPROVE PRODUCTION: EXPORT OS DATA       (export - creates a backup containing personal data)
#   APPROVE PRODUCTION DELETE: OS FUNCTIONS AND SITE   (remove)
#   APPROVE PRODUCTION: OS CLEANUP           (cleanup)
# Usage: os-retire.sh export|remove|cleanup [--execute]   (dry run by default)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../iam/h2-common.sh"
MODE="${1:-}"; [[ "${2:-}" == "--execute" ]] && EXECUTE=true
OS_FUNCTIONS=(api executeAgentTask processWorkflowEvent initializeProjectWorkflow handleWorkflowTaskResult monitorWorkflowTimeouts recoverAgentQueue monitorBusinessRisks dailyCeoReport)
KEEP_FUNCTIONS=(dailyFirestoreBackup backupFreshnessWatchdog)
OS_SITE="pageloom-os-production"
OS_WEB_APP="1:386075478217:web:4d0728a2dab970dbee2518"
ARCHIVE="gs://pageloom-os-archive-$(date -u +%Y%m%d)"
HEALTH_URLS=("https://pageloom-golden-noga-260815.web.app/")
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight
landing_ok() { local u; for u in "${HEALTH_URLS[@]}"; do [[ "$(curl -s -o /dev/null -w '%{http_code}' "$u")" == 200 ]] || { echo "ABORT: landing page $u not 200" >&2; exit 1; }; done; echo "  landing page OK"; }
backup_fns_ok() { local f; for f in "${KEEP_FUNCTIONS[@]}"; do gcloud functions describe "$f" --region="$REGION" --project="$PROJECT" --format='value(state)' | grep -q ACTIVE || { echo "ABORT: $f not ACTIVE" >&2; exit 1; }; done; echo "  backup functions ACTIVE"; }

case "$MODE" in
  export)
    run gcloud storage buckets create "$ARCHIVE" --project="$PROJECT" --location=EU \
      --uniform-bucket-level-access --public-access-prevention --retention-period=30d
    echo "+ lifecycle on $ARCHIVE: delete at age 365 days"
    if $EXECUTE; then printf '{"rule":[{"action":{"type":"Delete"},"condition":{"age":365}}]}' > "$TEMP/os-archive-lifecycle.json"
      gcloud storage buckets update "$ARCHIVE" --lifecycle-file="$TEMP/os-archive-lifecycle.json"; fi
    run gcloud storage buckets add-iam-policy-binding "$ARCHIVE" \
      --member="serviceAccount:service-386075478217@gcp-sa-firestore.iam.gserviceaccount.com" --role=roles/storage.admin
    run gcloud firestore export "$ARCHIVE/firestore-default" --database='(default)' --project="$PROJECT"
    ;;
  remove)
    if $EXECUTE; then
      for j in monitorWorkflowTimeouts recoverAgentQueue monitorBusinessRisks dailyCeoReport; do
        gcloud scheduler jobs describe "firebase-schedule-${j}-${REGION}" --location="$REGION" --project="$PROJECT" --format='value(state)' | grep -q PAUSED \
          || { echo "ABORT: OS is not frozen ($j not paused) - run os-freeze.sh first" >&2; exit 1; }
      done
    fi
    for f in "${OS_FUNCTIONS[@]}"; do run firebase functions:delete "$f" --region "$REGION" --project "$PROJECT" --force; done
    $EXECUTE && { backup_fns_ok; landing_ok; }
    run firebase hosting:disable --site "$OS_SITE" --project "$PROJECT" --force
    $EXECUTE && landing_ok
    ;;
  cleanup)
    if $EXECUTE; then
      n="$(gcloud functions list --project="$PROJECT" --format='value(name.basename())' | grep -vcE '^(dailyFirestoreBackup|backupFreshnessWatchdog)$' || true)"
      [[ "$n" == 0 ]] || { echo "ABORT: $n OS function(s) still deployed - run remove first" >&2; exit 1; }
    fi
    h2_invokers remove
    run gcloud iam service-accounts delete "$API_SA" --project="$PROJECT" --quiet
    run gcloud iam service-accounts delete "$AGENTS_SA" --project="$PROJECT" --quiet
    for s in "${SECRETS[@]}"; do
      echo "+ disable all enabled versions of secret $s"
      if $EXECUTE; then for v in $(gcloud secrets versions list "$s" --project="$PROJECT" --filter='state=ENABLED' --format='value(name.basename())' | tr -d '\r'); do
        gcloud secrets versions disable "$v" --secret="$s" --project="$PROJECT" --quiet >/dev/null; done; fi
    done
    echo "+ remove Firebase web app $OS_WEB_APP (restorable 30 days)"
    if $EXECUTE; then
      TOKEN="$(gcloud auth print-access-token)" PROJECT="$PROJECT" APP="$OS_WEB_APP" node -e '
      const P=process.env.PROJECT,H={Authorization:"Bearer "+process.env.TOKEN,"x-goog-user-project":P,"Content-Type":"application/json"};
      fetch(`https://firebase.googleapis.com/v1beta1/projects/${P}/webApps/${process.env.APP}:remove`,{method:"POST",headers:H,body:JSON.stringify({immediate:false})}).then(r=>{console.log("  web app remove:",r.status);if(!r.ok)process.exit(1)})'
      backup_fns_ok; landing_ok
    fi
    # Alert P9 watches monitorBusinessRisks, which no longer exists. The other function/scheduler
    # alerts (P3, P4, P4b, P5, P6, P7) also cover the backup functions and stay.
    echo "+ delete alert policy 'PageLoom P9 - monitorBusinessRisks dead-man' (OS-only)"
    if $EXECUTE; then
      TOKEN="$(gcloud auth print-access-token)" PROJECT="$PROJECT" node -e '
      const P=process.env.PROJECT,H={Authorization:"Bearer "+process.env.TOKEN,"x-goog-user-project":P};
      (async()=>{const l=await (await fetch(`https://monitoring.googleapis.com/v3/projects/${P}/alertPolicies?pageSize=50`,{headers:H})).json();
       const p=(l.alertPolicies||[]).find(x=>x.displayName==="PageLoom P9 - monitorBusinessRisks dead-man");if(!p){console.log("  P9 already gone");return}
       const r=await fetch(`https://monitoring.googleapis.com/v3/${p.name}`,{method:"DELETE",headers:H});console.log("  P9 delete:",r.status);if(!r.ok)process.exit(1)})()'
    fi
    echo "Next: sec-auth-after-os.sh (domains + anonymous off) and sec-api-keys.sh retire."
    ;;
  *) echo "usage: $0 export|remove|cleanup [--execute]" >&2; exit 2 ;;
esac
