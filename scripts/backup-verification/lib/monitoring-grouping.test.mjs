import { test } from "node:test";
import assert from "node:assert/strict";
import { P10_ABSENT, P5_MEMORY, changedPaths, groupedPolicy, guardPolicy } from "./monitoring-grouping.mjs";

// Shapes copied from the real policies (2026-11-23), ids shortened.
const p10 = () => ({
  name: "projects/p/alertPolicies/10", displayName: "PageLoom P10 - Backup Freshness & Service Health Watchdog", combiner: "OR", enabled: true,
  notificationChannels: ["projects/p/notificationChannels/1"], alertStrategy: { autoClose: "604800s" },
  creationRecord: { mutateTime: "2026-08-31T00:00:00Z" }, mutationRecord: { mutateTime: "2026-08-31T00:00:00Z" },
  conditions: [
    { name: "c1", displayName: "Backup stale (Firestore or Storage Transfer)", conditionThreshold: { filter: 'resource.type="cloud_run_revision" AND metric.type="logging.googleapis.com/user/pageloom_watchdog_backup_stale"', aggregations: [{ alignmentPeriod: "3600s", perSeriesAligner: "ALIGN_SUM" }], comparison: "COMPARISON_GT", duration: "0s", trigger: { count: 1 } } },
    { name: "c2", displayName: "Relevant active Service Health incident", conditionThreshold: { filter: 'resource.type="cloud_run_revision" AND metric.type="logging.googleapis.com/user/pageloom_watchdog_service_health"', aggregations: [{ alignmentPeriod: "3600s", perSeriesAligner: "ALIGN_SUM" }], comparison: "COMPARISON_GT", duration: "0s", trigger: { count: 1 } } },
    { name: "c3", displayName: P10_ABSENT, conditionAbsent: { filter: 'resource.type="cloud_run_revision" AND metric.type="logging.googleapis.com/user/pageloom_watchdog_heartbeat"', aggregations: [{ alignmentPeriod: "300s", perSeriesAligner: "ALIGN_COUNT" }], duration: "50400s", trigger: { count: 1 } } },
  ],
});
const p5 = () => ({
  name: "projects/p/alertPolicies/5", displayName: "PageLoom P5 - Memory/resource exhaustion", combiner: "OR", enabled: true,
  notificationChannels: ["projects/p/notificationChannels/1"], alertStrategy: { autoClose: "604800s" },
  conditions: [
    { name: "m1", displayName: "Memory limit exceeded log occurrence", conditionThreshold: { filter: 'resource.type="cloud_run_revision" AND metric.type="logging.googleapis.com/user/pageloom_memory_limit_exceeded"', aggregations: [{ alignmentPeriod: "10800s", perSeriesAligner: "ALIGN_SUM" }], comparison: "COMPARISON_GT", duration: "0s" } },
    { name: "m2", displayName: P5_MEMORY, conditionThreshold: { filter: 'resource.type="cloud_run_revision" AND metric.type="run.googleapis.com/container/memory/utilizations"', aggregations: [{ alignmentPeriod: "900s", perSeriesAligner: "ALIGN_PERCENTILE_99" }], comparison: "COMPARISON_GT", thresholdValue: 0.8, duration: "900s" } },
  ],
});

test("P10: only the dead-man condition gets grouped by service; everything else identical", () => {
  const before = p10();
  const after = groupedPolicy(before, P10_ABSENT);
  const paths = changedPaths({ ...before, creationRecord: undefined, mutationRecord: undefined }, after).sort();
  assert.deepEqual(paths, ["conditions.2.conditionAbsent.aggregations.0.crossSeriesReducer", "conditions.2.conditionAbsent.aggregations.0.groupByFields"]);
  assert.equal(after.conditions[2].conditionAbsent.aggregations[0].crossSeriesReducer, "REDUCE_SUM");
  assert.deepEqual(after.conditions[2].conditionAbsent.aggregations[0].groupByFields, ["resource.label.service_name"]);
  assert.equal(after.creationRecord, undefined);
  assert.deepEqual(before, p10(), "input not mutated");
});

test("P5: only the memory-utilization condition gets grouped (REDUCE_MAX)", () => {
  const before = p5();
  const after = groupedPolicy(before, P5_MEMORY);
  assert.deepEqual(changedPaths(before, after).sort(), ["conditions.1.conditionThreshold.aggregations.0.crossSeriesReducer", "conditions.1.conditionThreshold.aggregations.0.groupByFields"]);
  assert.equal(after.conditions[1].conditionThreshold.aggregations[0].crossSeriesReducer, "REDUCE_MAX");
  assert.equal(after.conditions[1].conditionThreshold.thresholdValue, 0.8);
});

test("guard refuses a re-run (already grouped), a missing condition, or drift", () => {
  const grouped = groupedPolicy(p10(), P10_ABSENT);
  assert.throws(() => guardPolicy(grouped, P10_ABSENT), /already grouped/);
  assert.throws(() => guardPolicy(p5(), P10_ABSENT), /no condition/);
  const drift = p10(); drift.conditions[2].conditionAbsent.aggregations[0].perSeriesAligner = "ALIGN_SUM";
  assert.throws(() => guardPolicy(drift, P10_ABSENT), /aligner/);
  const wrongKind = p5(); wrongKind.conditions[1] = { displayName: P5_MEMORY, conditionAbsent: wrongKind.conditions[1].conditionThreshold };
  assert.throws(() => guardPolicy(wrongKind, P5_MEMORY), /not conditionThreshold/);
  const twoAgg = p5(); twoAgg.conditions[1].conditionThreshold.aggregations.push({});
  assert.throws(() => guardPolicy(twoAgg, P5_MEMORY), /exactly one/);
  assert.throws(() => guardPolicy(undefined, P5_MEMORY));
});

test("notification channels, alert strategy, enabled and combiner are never touched", () => {
  for (const [make, cond] of [[p10, P10_ABSENT], [p5, P5_MEMORY]]) {
    const b = make(); const a = groupedPolicy(b, cond);
    for (const k of ["notificationChannels", "alertStrategy", "enabled", "combiner", "displayName", "name"]) assert.deepEqual(a[k], b[k], k);
  }
});
