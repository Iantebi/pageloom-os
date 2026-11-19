#!/usr/bin/env bash
# Security fix A2/A3 - ONLY AFTER PageLoom OS is retired (its Discovery-link flow uses anonymous
# sign-in, and 5 OS members are anonymous users). Removes the remaining dev/OS-only Auth domains
# (localhost, the OS discovery-verify preview channel) and turns anonymous sign-in off.
# Keeps web.app / firebaseapp.com (needed by any Firebase Auth web sign-in).
# PRODUCTION-CHANGING. Approval: APPROVE PRODUCTION AUTH: POST-OS CLEANUP
# Dry run by default; --execute to apply. Undo: PATCH the saved config back (snapshot is written).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../iam/h2-common.sh"
[[ "${1:-}" == "--execute" ]] && EXECUTE=true
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight
REMOVE=(localhost pageloom-os-production--discovery-verify-2-cvicjs0g.web.app)
echo "+ PATCH identitytoolkit config: authorizedDomains -= ${REMOVE[*]} ; signIn.anonymous.enabled=false"
if $EXECUTE; then
  [[ "$(gcloud functions list --project="$PROJECT" --format='value(name)' | grep -c . || true)" == 0 ]] || \
    { echo "ABORT: OS functions still deployed - retire OS first" >&2; exit 1; }
  TOKEN="$(gcloud auth print-access-token)" PROJECT="$PROJECT" REMOVE="${REMOVE[*]}" node -e '
  const P=process.env.PROJECT,H={Authorization:"Bearer "+process.env.TOKEN,"x-goog-user-project":P,"Content-Type":"application/json"};
  const rm=process.env.REMOVE.split(" "),url=`https://identitytoolkit.googleapis.com/admin/v2/projects/${P}/config`;
  (async()=>{const c=await (await fetch(url,{headers:H})).json();require("fs").writeFileSync(`auth-config-before-${Date.now()}.json`,JSON.stringify(c,null,1));
   const r=await fetch(url+"?updateMask=authorizedDomains,signIn.anonymous.enabled",{method:"PATCH",headers:H,body:JSON.stringify({authorizedDomains:c.authorizedDomains.filter(d=>!rm.includes(d)),signIn:{anonymous:{enabled:false}}})});
   console.log("PATCH",r.status);if(!r.ok)process.exit(1)})()'
fi
