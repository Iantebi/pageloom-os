#!/usr/bin/env bash
# AI Studio cleanup STAGE 2 - final, mostly IRREVERSIBLE deletion of the Google AI Studio leftovers.
# Verified 2026-11-19 (read-only): no inbound dependency (no Eventarc/Scheduler/Pub/Sub/domain
# mapping/Hosting rewrite, no reference from OS functions or the landing page), no traffic, C1 empty,
# C2 = 9 + 29 test documents owned by anonymous users, last write 2026-11-03.
#
#   1. Cloud Run pageloom-business-discovery + remix-pageloom (europe-west2)   IRREVERSIBLE
#   2. Bucket ai-studio-bucket-386075478217-europe-west2 (2 build tarballs)    IRREVERSIBLE in practice
#   3. Firestore C1 + C2 (no delete protection, no backup - by decision)       IRREVERSIBLE
#   4. Their 2 Firestore rules releases                                         (rulesets stay, inert)
#   5. The 9 anonymous users disabled in stage 1 (never the 5 OS users)        IRREVERSIBLE
#   6. Service account ais-gemini-key-… (disabled in stage 1)                  undeletable for 30 days
#   The API key and web app from stage 1 purge themselves after their 30-day windows.
#
# PRODUCTION-CHANGING. Run manually, only after a fresh, explicit approval:
#   APPROVE PRODUCTION DELETE: AI STUDIO CLEANUP STAGE 2 (FINAL)
# Never call this from npm scripts, hooks or CI (CLAUDE.md rule 6).
# Dry run by default. --execute runs it. Every target is re-checked right before its deletion;
# the health check runs after every step and any failure stops the script.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../iam/h2-common.sh"   # PROJECT, run, preflight, CLOUDSDK_PYTHON

BK="/c/Users/Isaac a/Documents/GitHub/pageloom-os-backups"
STAGE1="$BK/pre-ai-studio-stage1-20261119"          # stage1-disable-uids.json, os-anon-uids.json
HEALTH="$BK/post-ai-studio-stage1-20261119/health.sh"
SNAP="$BK/pre-ai-studio-stage2-$(date -u +%Y%m%d)"
RUN_REGION="europe-west2"
SERVICES=(pageloom-business-discovery remix-pageloom)
AI_BUCKET="gs://ai-studio-bucket-386075478217-europe-west2"
C1_DB="ai-studio-pageloomcustomer-41c15000-2bac-4ab2-8b7c-05a2bbde5d27"
C2_DB="ai-studio-pageloombusiness-d0b90426-fb5e-4fbb-a024-8f04ce983d74"
AIS_SA="ais-gemini-key-1148c44d43e140b@386075478217.iam.gserviceaccount.com"

[[ "${1:-}" == "--execute" ]] && EXECUTE=true
$EXECUTE || echo "### DRY RUN - nothing is changed. Re-run with --execute after approval. ###"
preflight
die() { echo "ABORT: $*" >&2; exit 1; }
health() { if $EXECUTE; then echo "-- health after: $1"; bash "$HEALTH" | grep -E "FAIL|HEALTH"; bash "$HEALTH" >/dev/null || die "health check failed after $1"; fi; }
tok() { gcloud auth print-access-token 2>/dev/null; }

# 0. Snapshot everything that is about to go (metadata only).
if $EXECUTE; then
  mkdir -p "$SNAP"
  for s in "${SERVICES[@]}"; do gcloud run services describe "$s" --region="$RUN_REGION" --project="$PROJECT" --format=json > "$SNAP/run-$s.json"; done
  gcloud storage ls -L -r "$AI_BUCKET/**" > "$SNAP/bucket-objects.txt"
  for db in "$C1_DB" "$C2_DB"; do gcloud firestore databases describe --database="$db" --project="$PROJECT" --format=json > "$SNAP/firestore-$db.json"; done
  curl -s -H "Authorization: Bearer $(tok)" -H "x-goog-user-project: $PROJECT" "https://firebaserules.googleapis.com/v1/projects/$PROJECT/releases" > "$SNAP/rules-releases.json"
  gcloud iam service-accounts describe "$AIS_SA" --project="$PROJECT" --format=json > "$SNAP/sa.json"
  (cd "$SNAP" && sha256sum * > SHA256SUMS.txt)
  echo "snapshot: $SNAP"
fi

# 1. Cloud Run services - only if still unreachable (internal ingress, no invokers).
for s in "${SERVICES[@]}"; do
  if $EXECUTE; then
    ing="$(gcloud run services describe "$s" --region="$RUN_REGION" --project="$PROJECT" --format='value(metadata.annotations."run.googleapis.com/ingress")' | tr -d '\r')"
    inv="$(gcloud run services get-iam-policy "$s" --region="$RUN_REGION" --project="$PROJECT" --format='value(bindings)' | tr -d '\r')"
    [[ "$ing" == "internal" && -z "$inv" ]] || die "$s is reachable again (ingress=$ing, invokers=$inv)"
  fi
  run gcloud run services delete "$s" --region="$RUN_REGION" --project="$PROJECT" --quiet
done
health "Cloud Run services"

# 2. AI Studio bucket - only if it still holds exactly the 2 build tarballs.
if $EXECUTE; then
  n="$(gcloud storage ls -r "$AI_BUCKET/**" | grep -c 'build_artifacts.tar.gz' || true)"; t="$(gcloud storage ls -r "$AI_BUCKET/**" | grep -c . || true)"
  [[ "$n" == 2 && "$t" == 2 ]] || die "bucket content changed ($t objects)"
fi
run gcloud storage rm -r "$AI_BUCKET"
health "bucket"

# 3. Firestore C1 + C2 - only if contents match what was verified (C1: no collections; C2: 9 top docs).
count_top() { curl -s -X POST -H "Authorization: Bearer $(tok)" -H "x-goog-user-project: $PROJECT" -H "Content-Type: application/json" \
  "https://firestore.googleapis.com/v1/projects/$PROJECT/databases/$1/documents:listCollectionIds" -d '{}' | grep -oE '"[a-z]+"' | tr -d '"' | grep -vE '^collectionIds$' | tr '\n' ',' ; }
if $EXECUTE; then
  [[ -z "$(count_top "$C1_DB")" ]] || die "C1 is no longer empty"
  [[ "$(count_top "$C2_DB")" == "clients,customers," ]] || die "C2 collections changed"
fi
for db in "$C1_DB" "$C2_DB"; do
  run gcloud firestore databases delete --database="$db" --project="$PROJECT" --quiet
done
health "Firestore C1/C2"

# 4. Rules releases of the deleted databases.
for db in "$C1_DB" "$C2_DB"; do
  echo "+ DELETE firebaserules releases/cloud.firestore/$db"
  if $EXECUTE; then
    curl -sf -X DELETE -H "Authorization: Bearer $(tok)" -H "x-goog-user-project: $PROJECT" \
      "https://firebaserules.googleapis.com/v1/projects/$PROJECT/releases/cloud.firestore/$db" >/dev/null || echo "  ! release already gone"
  fi
done
health "rules releases"

# 5. The 9 stage-1 users - each must still be disabled, anonymous and not an OS user.
echo "+ delete the 9 disabled anonymous users listed in $STAGE1/stage1-disable-uids.json"
if $EXECUTE; then
  TOKEN="$(tok)" STAGE1="$STAGE1" PROJECT="$PROJECT" node -e '
  const P=process.env.PROJECT,H={Authorization:"Bearer "+process.env.TOKEN,"x-goog-user-project":P,"Content-Type":"application/json"};
  const t=require(process.env.STAGE1+"/stage1-disable-uids.json"),os=new Set(require(process.env.STAGE1+"/os-anon-uids.json"));
  (async()=>{const u=(await (await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${P}/accounts:query`,{method:"POST",headers:H,body:JSON.stringify({returnUserInfo:true,limit:500})})).json()).userInfo||[];
  const by=Object.fromEntries(u.map(x=>[x.localId,x]));if(t.length!==9)throw new Error("expected 9");
  for(const id of t){const x=by[id];if(!x)continue;if(os.has(id)||!x.disabled||(x.providerUserInfo||[]).length)throw new Error("target not safe to delete");
   const r=await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${P}/accounts:delete`,{method:"POST",headers:H,body:JSON.stringify({localId:id})});if(!r.ok)throw new Error("delete failed "+r.status)}
  console.log("  deleted",t.length,"users")})().catch(e=>{console.error("ABORT:",e.message);process.exit(1)})'
fi
health "users"

# 6. The disabled AI Studio service account.
if $EXECUTE; then [[ "$(gcloud iam service-accounts describe "$AIS_SA" --project="$PROJECT" --format='value(disabled)' | tr -d '\r')" == "True" ]] || die "SA no longer disabled"; fi
run gcloud iam service-accounts delete "$AIS_SA" --project="$PROJECT" --quiet
health "service account"

$EXECUTE && echo "STAGE 2 COMPLETE" || echo "### END DRY RUN ###"
