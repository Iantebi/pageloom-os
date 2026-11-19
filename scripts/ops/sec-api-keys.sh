#!/usr/bin/env bash
# Security fix A4 - API keys.
#   restrict : limit the Firebase browser key to the OS web origins (today it has NO website
#              restriction). The static landing page does not use Firebase at all.
#   retire   : after OS retirement - delete the browser key and "PageLoom Gemini Production"
#              (no Gemini/Vertex traffic in 30 days). Soft delete: undeletable for 30 days.
# PRODUCTION-CHANGING. Approvals: APPROVE PRODUCTION: API KEY RESTRICTIONS / ...: API KEY RETIREMENT
# Usage: sec-api-keys.sh restrict|retire [--execute]   (dry run by default)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../iam/h2-common.sh"
BROWSER_KEY="e3cbe12f-37a5-4ba2-987a-ef549819a0a9"
GEMINI_KEY="7321a1d9-46c2-4f70-9cb9-b20f6845388c"
MODE="${1:-restrict}"; [[ "${2:-}" == "--execute" ]] && EXECUTE=true
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight
case "$MODE" in
  restrict)
    # REST PATCH with updateMask=restrictions.browserKeyRestrictions, so the key's existing API
    # target list is left exactly as it is (verified after the call).
    echo "+ PATCH apikeys $BROWSER_KEY restrictions.browserKeyRestrictions.allowedReferrers=[web.app, firebaseapp.com]"
    if $EXECUTE; then
      TOKEN="$(gcloud auth print-access-token)" PROJECT="$PROJECT" KEY="$BROWSER_KEY" node -e '
      const P=process.env.PROJECT,K=process.env.KEY,H={Authorization:"Bearer "+process.env.TOKEN,"x-goog-user-project":P,"Content-Type":"application/json"};
      const url=`https://apikeys.googleapis.com/v2/projects/${P}/locations/global/keys/${K}`;
      (async()=>{const before=await (await fetch(url,{headers:H})).json();const targets=JSON.stringify((before.restrictions||{}).apiTargets||[]);
       require("fs").writeFileSync(`browser-key-before-${Date.now()}.json`,JSON.stringify(before,null,1));
       const r=await fetch(url+"?updateMask=restrictions.browserKeyRestrictions",{method:"PATCH",headers:H,body:JSON.stringify({restrictions:{browserKeyRestrictions:{allowedReferrers:["https://pageloom-os-production.web.app/*","https://pageloom-os-production.firebaseapp.com/*"]}}})});
       if(!r.ok){console.log("ERROR",r.status,JSON.stringify((await r.json()).error));process.exit(1)}
       await new Promise(s=>setTimeout(s,15000));const after=await (await fetch(url,{headers:H})).json();
       const same=JSON.stringify((after.restrictions||{}).apiTargets||[])===targets;console.log("referrers:",JSON.stringify(after.restrictions.browserKeyRestrictions),"| API targets unchanged:",same);if(!same)process.exit(1)})()'
    fi ;;
  retire)
    if $EXECUTE; then [[ "$(gcloud functions list --project="$PROJECT" --format='value(name.basename())' | tr -d '\r' | grep -vcE '^(dailyFirestoreBackup|backupFreshnessWatchdog)$' || true)" == 0 ]] || { echo "ABORT: retire OS first" >&2; exit 1; }; fi
    run gcloud services api-keys delete "$BROWSER_KEY" --project="$PROJECT" --quiet
    run gcloud services api-keys delete "$GEMINI_KEY" --project="$PROJECT" --quiet ;;
  *) echo "usage: $0 restrict|retire [--execute]" >&2; exit 2 ;;
esac
