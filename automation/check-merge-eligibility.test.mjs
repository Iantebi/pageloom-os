import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { evaluateMergeEligibility, evaluateWorkerHealth } from "./check-merge-eligibility.mjs";

const policy = JSON.parse(
  readFileSync(fileURLToPath(new URL("./policy.json", import.meta.url)), "utf8"),
);

function basePr(overrides) {
  return {
    labels: ["autonomous:safe", "autonomous:qa-passed"],
    isDraft: false,
    mergeable: "MERGEABLE",
    mergeStateStatus: "CLEAN",
    reviewDecision: "APPROVED",
    statusCheckRollup: [{ name: "verify", conclusion: "SUCCESS" }],
    ...overrides,
  };
}

test("fully green SAFE PR with QA passed is eligible", () => {
  const { eligible, reasons } = evaluateMergeEligibility(basePr({}), policy);
  assert.equal(eligible, true);
  assert.deepEqual(reasons, []);
});

test("missing QA-passed label blocks even if everything else is green", () => {
  const { eligible, reasons } = evaluateMergeEligibility(basePr({ labels: ["autonomous:safe"] }), policy);
  assert.equal(eligible, false);
  assert.ok(reasons.some((r) => r.includes("QA/Safety review has not passed")));
});

test("QA changes-requested label blocks even with QA passed also present", () => {
  const { eligible, reasons } = evaluateMergeEligibility(
    basePr({ labels: ["autonomous:safe", "autonomous:qa-passed", "autonomous:qa-changes-requested"] }),
    policy,
  );
  assert.equal(eligible, false);
  assert.ok(reasons.some((r) => r.includes("requested changes")));
});

test("PROTECTED label always blocks, even if everything else is green", () => {
  const { eligible } = evaluateMergeEligibility(
    basePr({ labels: ["autonomous:safe", "autonomous:qa-passed", "autonomous:protected"] }),
    policy,
  );
  assert.equal(eligible, false);
});

test("missing SAFE label blocks by default", () => {
  const { eligible } = evaluateMergeEligibility(basePr({ labels: [] }), policy);
  assert.equal(eligible, false);
});

test("merge conflict blocks", () => {
  const { eligible, reasons } = evaluateMergeEligibility(basePr({ mergeable: "CONFLICTING" }), policy);
  assert.equal(eligible, false);
  assert.ok(reasons.some((r) => r.includes("conflict")));
});

test("changes requested (general review) blocks", () => {
  const { eligible } = evaluateMergeEligibility(basePr({ reviewDecision: "CHANGES_REQUESTED" }), policy);
  assert.equal(eligible, false);
});

test("failing check blocks", () => {
  const { eligible, reasons } = evaluateMergeEligibility(
    basePr({ statusCheckRollup: [{ name: "verify", conclusion: "FAILURE" }] }),
    policy,
  );
  assert.equal(eligible, false);
  assert.ok(reasons.some((r) => r.includes("verify")));
});

test("worker health: all checks passing is healthy", () => {
  const { healthy, failingChecks } = evaluateWorkerHealth(basePr({}));
  assert.equal(healthy, true);
  assert.deepEqual(failingChecks, []);
});

test("worker health: a failed check is unhealthy and named", () => {
  const { healthy, failingChecks } = evaluateWorkerHealth(
    basePr({ statusCheckRollup: [{ name: "test", conclusion: "FAILURE" }, { name: "lint", conclusion: "SUCCESS" }] }),
  );
  assert.equal(healthy, false);
  assert.deepEqual(failingChecks, ["test"]);
});

test("worker health: pending checks (no conclusion yet) are not treated as failing", () => {
  const { healthy } = evaluateWorkerHealth(basePr({ statusCheckRollup: [{ name: "test", conclusion: null }] }));
  assert.equal(healthy, true);
});
