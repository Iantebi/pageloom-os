/**
 * Pure transform for scripts/ops/sec-monitoring-group-by-service.sh (2026-11-23 finding).
 *
 * Two alert conditions evaluate every Cloud Run REVISION as its own time series:
 *  - P10 "Watchdog heartbeat missing (dead-man, 14h)" (conditionAbsent): after each deploy the
 *    replaced revision stops sending heartbeats, so 14 h later its series is "absent" and a false
 *    incident opens that never closes (seen after the deploys of 2026-11-18/19/20, and expected
 *    ~14 h after the 2026-11-23 deploy).
 *  - P5 "Container memory utilization > 80%": incidents are tied to individual revisions, incl. those
 *    of the deleted OS services, and stay open.
 * Fix: aggregate across revisions per Cloud Run service (crossSeriesReducer + groupByFields
 * resource.label.service_name). Nothing else in either policy changes.
 */
export const P10_ABSENT = "Watchdog heartbeat missing (dead-man, 14h)";
export const P5_MEMORY = "Container memory utilization > 80%";
export const GROUP_BY = ["resource.label.service_name"];
const REDUCER = { [P10_ABSENT]: "REDUCE_SUM", [P5_MEMORY]: "REDUCE_MAX" };
const KIND = { [P10_ABSENT]: "conditionAbsent", [P5_MEMORY]: "conditionThreshold" };
const ALIGNER = { [P10_ABSENT]: "ALIGN_COUNT", [P5_MEMORY]: "ALIGN_PERCENTILE_99" };

const clone = (x) => JSON.parse(JSON.stringify(x));

/** Throws unless the policy still looks exactly as audited (so a re-run or drift is refused). */
export function guardPolicy(policy, conditionName) {
  const fail = (m) => { throw new Error(`GUARD FAILED (${policy?.displayName}): ${m}`); };
  const cond = policy?.conditions?.find((c) => c.displayName === conditionName);
  if (!cond) fail(`no condition "${conditionName}"`);
  const body = cond[KIND[conditionName]];
  if (!body) fail(`condition is not ${KIND[conditionName]}`);
  if (body.aggregations?.length !== 1) fail("expected exactly one aggregation");
  const agg = body.aggregations[0];
  if (agg.perSeriesAligner !== ALIGNER[conditionName]) fail(`aligner is ${agg.perSeriesAligner}`);
  if (agg.crossSeriesReducer || agg.groupByFields) fail("already grouped - nothing to do");
  if (!/resource\.type="cloud_run_revision"/.test(body.filter ?? "")) fail("filter is not on cloud_run_revision");
  return true;
}

/** New policy body for `gcloud alpha monitoring policies update --policy-from-file`. */
export function groupedPolicy(policy, conditionName) {
  guardPolicy(policy, conditionName);
  const p = clone(policy);
  delete p.creationRecord;
  delete p.mutationRecord;
  const body = p.conditions.find((c) => c.displayName === conditionName)[KIND[conditionName]];
  body.aggregations[0].crossSeriesReducer = REDUCER[conditionName];
  body.aggregations[0].groupByFields = [...GROUP_BY];
  return p;
}

/** Every JSON path that differs between two values (for review output and tests). */
export function changedPaths(a, b, path = "") {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return keys.flatMap((k) => changedPaths(a[k], b[k], path ? `${path}.${k}` : k));
  }
  return [path];
}
