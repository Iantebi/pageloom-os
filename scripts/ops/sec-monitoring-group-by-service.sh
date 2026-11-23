#!/usr/bin/env bash
# Groups two per-REVISION alert conditions by Cloud Run SERVICE (2026-11-23 read-only finding):
#  P10 "Watchdog heartbeat missing (dead-man, 14h)" - every deploy replaced a watchdog revision whose
#      heartbeat series then went "absent", opening a false incident 14 h later that never closed
#      (3 open: revisions 00017/00018/00019, after the deploys of 2026-11-18/19/20).
#  P5  "Container memory utilization > 80%" - incidents tied to single revisions, incl. 10 still open
#      for OS services deleted on 2026-11-19.
# Verified read-only before writing this: with crossSeriesReducer + groupByFields
# resource.label.service_name the API returns ONE heartbeat series across revisions (25 points =
# 24 on 00020 + 1 on 00021) and one memory series per service. Nothing else in either policy changes
# (lib/monitoring-grouping.mjs + tests). Open incidents of the edited conditions are expected to close
# (as P7's did when its condition changed on 2026-11-23) - verify after.
#
# PRODUCTION-CHANGING (Monitoring). Approval: APPROVE PRODUCTION MONITORING: P5 + P10 GROUP BY SERVICE
# Usage: sec-monitoring-group-by-service.sh [--execute]             dry run by default
#        sec-monitoring-group-by-service.sh --restore <dir> [--execute]
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/../iam/h2-common.sh"
CLI="$HERE/../backup-verification/monitoring-grouping-cli.mjs"

P10_POLICY="projects/${PROJECT}/alertPolicies/12748440516229195358"
P5_POLICY="projects/${PROJECT}/alertPolicies/12319412166509968826"
P10_COND="Watchdog heartbeat missing (dead-man, 14h)"
P5_COND="Container memory utilization > 80%"

RESTORE_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute) EXECUTE=true ;;
    --restore) RESTORE_DIR="$2"; shift ;;
    *) echo "usage: $0 [--execute] | --restore <dir> [--execute]" >&2; exit 2 ;;
  esac
  shift
done
$EXECUTE || echo "### DRY RUN - nothing is changed. ###"
preflight

if [[ -n "$RESTORE_DIR" ]]; then
  [[ -f "$RESTORE_DIR/p10-policy.json" && -f "$RESTORE_DIR/p5-policy.json" ]] || { echo "ABORT: not a snapshot dir" >&2; exit 1; }
  for f in p10 p5; do node -e 'const p=require(process.argv[1]);delete p.creationRecord;delete p.mutationRecord;require("fs").writeFileSync(process.argv[2],JSON.stringify(p))' "$RESTORE_DIR/$f-policy.json" "$RESTORE_DIR/$f-policy.restore.json"; done
  run gcloud alpha monitoring policies update "$P10_POLICY" --project="$PROJECT" --policy-from-file="$RESTORE_DIR/p10-policy.restore.json"
  run gcloud alpha monitoring policies update "$P5_POLICY" --project="$PROJECT" --policy-from-file="$RESTORE_DIR/p5-policy.restore.json"
  exit 0
fi

SNAP="${SNAPSHOT_DIR:-$(mktemp -d)}"; mkdir -p "$SNAP"
gcloud alpha monitoring policies describe "$P10_POLICY" --project="$PROJECT" --format=json > "$SNAP/p10-policy.json"
gcloud alpha monitoring policies describe "$P5_POLICY" --project="$PROJECT" --format=json > "$SNAP/p5-policy.json"
echo "snapshot (undo source): $SNAP"

# Guard + transform (local files only); refuses if production no longer matches the audited state.
node "$CLI" "$SNAP/p10-policy.json" "$P10_COND" "$SNAP/p10-policy.new.json"
node "$CLI" "$SNAP/p5-policy.json" "$P5_COND" "$SNAP/p5-policy.new.json"

echo "-- 1. P10: group the heartbeat dead-man condition by service"
run gcloud alpha monitoring policies update "$P10_POLICY" --project="$PROJECT" --policy-from-file="$SNAP/p10-policy.new.json"
echo "-- 2. P5: group the memory-utilization condition by service"
run gcloud alpha monitoring policies update "$P5_POLICY" --project="$PROJECT" --policy-from-file="$SNAP/p5-policy.new.json"

if $EXECUTE; then
  echo "-- post-check"
  for pol in "$P10_POLICY" "$P5_POLICY"; do
    gcloud alpha monitoring policies describe "$pol" --project="$PROJECT" --format=json | node -e '
      const p=JSON.parse(require("fs").readFileSync(0,"utf8"));
      for(const c of p.conditions){const b=c.conditionAbsent||c.conditionThreshold;const a=b.aggregations[0];console.log("   ",p.displayName.slice(0,40),"|",c.displayName,"|",a.crossSeriesReducer||"-",JSON.stringify(a.groupByFields||[]))}'
  done
  echo "   Then confirm the stale P10/P5 incidents closed (Monitoring > Incidents). Undo: $0 --restore $SNAP --execute"
fi
