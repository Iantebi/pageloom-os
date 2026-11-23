#!/usr/bin/env bash
# Fixes two Cloud Monitoring defects found in the 2026-11-23 read-only audit. Nothing else changes.
#
#  P1 "Firestore backup health", condition "Real dailyFirestoreBackup app error":
#     its log metric pageloom_firestorebackup_app_error filters on resource.labels.function_name,
#     a label Gen 2 runtime logs (resource.type=cloud_run_revision) never carry - only deploy audit
#     entries match it. Verified 2026-11-23: old filter = 0 of the service's 130 runtime log entries
#     in 30 days, new filter = all of them. Fix: filter on the Cloud Run service name instead.
#     (Backup failures were still caught by P1's and P3's Scheduler-failure conditions meanwhile.)
#  P7 "Availability and 5xx", condition "Uptime check failing":
#     the uptime check targets the retired OS site pageloom-os-production.web.app (Hosting disabled
#     2026-11-19, HTTP 404), so the condition is permanently failing - noise that can hide real alerts.
#     Fix: remove that condition from P7 (the 5xx-ratio condition stays) and rename the policy.
#     Deleting the uptime check itself is a separate, optional step (--delete-uptime).
#
# PRODUCTION-CHANGING (Monitoring). Approval: APPROVE PRODUCTION MONITORING: P1 + P7 FIX
#   (plus "... AND DELETE UPTIME CHECK" for --delete-uptime).
# Usage: sec-monitoring-p1-p7.sh [--execute] [--delete-uptime]     dry run by default
#        sec-monitoring-p1-p7.sh --restore <snapshot-dir> [--execute]  undo from a snapshot
# Every run first saves the current definitions (read-only) to a snapshot directory.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../iam/h2-common.sh"

P1_METRIC="pageloom_firestorebackup_app_error"
P7_POLICY="projects/${PROJECT}/alertPolicies/3655598129229339907"
UPTIME_CHECK="projects/${PROJECT}/uptimeCheckConfigs/pageloom-production-app-aW_KL8-UOkw"
UPTIME_CONDITION="Uptime check failing"
NEW_P1_FILTER='resource.type="cloud_run_revision" AND resource.labels.service_name="dailyfirestorebackup" AND severity>=ERROR AND NOT jsonPayload.message=~"already_completed|already exists"'

DELETE_UPTIME=false; RESTORE_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute) EXECUTE=true ;;
    --delete-uptime) DELETE_UPTIME=true ;;
    --restore) RESTORE_DIR="$2"; shift ;;
    *) echo "usage: $0 [--execute] [--delete-uptime] | --restore <dir> [--execute]" >&2; exit 2 ;;
  esac
  shift
done
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight

if [[ -n "$RESTORE_DIR" ]]; then
  [[ -f "$RESTORE_DIR/p1-metric.json" && -f "$RESTORE_DIR/p7-policy.json" ]] || { echo "ABORT: not a snapshot dir" >&2; exit 1; }
  old_filter="$(node -e 'console.log(require(process.argv[1]).filter)' "$RESTORE_DIR/p1-metric.json")"
  run gcloud logging metrics update "$P1_METRIC" --project="$PROJECT" --log-filter="$old_filter"
  run gcloud alpha monitoring policies update "$P7_POLICY" --project="$PROJECT" --policy-from-file="$RESTORE_DIR/p7-policy.json"
  echo "Note: a deleted uptime check cannot be restored under its old id; recreate it from $RESTORE_DIR/uptime-check.json if needed."
  exit 0
fi

SNAP="${SNAPSHOT_DIR:-$(mktemp -d)}"; mkdir -p "$SNAP"
gcloud logging metrics describe "$P1_METRIC" --project="$PROJECT" --format=json > "$SNAP/p1-metric.json"
gcloud alpha monitoring policies describe "$P7_POLICY" --project="$PROJECT" --format=json > "$SNAP/p7-policy.json"
gcloud monitoring uptime describe "$UPTIME_CHECK" --project="$PROJECT" --format=json > "$SNAP/uptime-check.json"
echo "snapshot (undo source): $SNAP"

# Guards: only proceed if production still looks exactly like the audit found it.
node -e '
const m=require(process.argv[1]),p=require(process.argv[2]),u=require(process.argv[3]);
const fail=(s)=>{console.error("GUARD FAILED: "+s);process.exit(1)};
if(!m.filter.includes("resource.labels.function_name=\"dailyFirestoreBackup\""))fail("P1 metric filter changed since the audit");
if(!p.conditions.some(c=>c.displayName===process.argv[4]))fail("P7 has no \""+process.argv[4]+"\" condition");
if(p.conditions.length!==2)fail("P7 condition count is not 2");
if(u.monitoredResource.labels.host!=="pageloom-os-production.web.app")fail("uptime check host changed");
console.log("GUARD OK")' "$SNAP/p1-metric.json" "$SNAP/p7-policy.json" "$SNAP/uptime-check.json" "$UPTIME_CONDITION"

# New P7 definition: same policy, uptime condition removed, output-only fields dropped.
node -e '
const p=require(process.argv[1]);
for(const k of ["creationRecord","mutationRecord"])delete p[k];
p.conditions=p.conditions.filter(c=>c.displayName!==process.argv[3]);
p.displayName="PageLoom P7 - Cloud Run 5xx ratio";
if(p.documentation&&p.documentation.content)p.documentation.content="**What failed:** The 5xx error ratio across the Cloud Run services (the two backup functions) exceeded 5% for 15 minutes.\n\n(The uptime check on the retired OS site was removed on the date of this change - PageLoom OS and its Hosting site were retired on 2026-11-19.)";
require("fs").writeFileSync(process.argv[2],JSON.stringify(p,null,2));
console.log("new P7 conditions:",p.conditions.map(c=>c.displayName).join(", "));' "$SNAP/p7-policy.json" "$SNAP/p7-policy.new.json" "$UPTIME_CONDITION"

echo "-- 1. P1 metric filter"
echo "   old: $(node -e 'console.log(require(process.argv[1]).filter)' "$SNAP/p1-metric.json")"
echo "   new: $NEW_P1_FILTER"
run gcloud logging metrics update "$P1_METRIC" --project="$PROJECT" --log-filter="$NEW_P1_FILTER"
echo "-- 2. P7: remove the uptime condition, keep 5xx ratio"
run gcloud alpha monitoring policies update "$P7_POLICY" --project="$PROJECT" --policy-from-file="$SNAP/p7-policy.new.json"
if $DELETE_UPTIME; then
  echo "-- 3. delete the uptime check on the retired site (optional)"
  run gcloud monitoring uptime delete "$UPTIME_CHECK" --project="$PROJECT" --quiet
fi

if $EXECUTE; then
  echo "-- post-check"
  gcloud logging metrics describe "$P1_METRIC" --project="$PROJECT" --format="value(filter)" | sed 's/^/   P1 filter: /'
  gcloud alpha monitoring policies describe "$P7_POLICY" --project="$PROJECT" --format="value(displayName,conditions.len())" | sed 's/^/   P7: /'
  echo "   Undo: $0 --restore $SNAP --execute"
fi
