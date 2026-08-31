import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { evaluateMergeEligibility } from "./check-merge-eligibility.mjs";

const policy = JSON.parse(
  readFileSync(fileURLToPath(new URL("./policy.json", import.meta.url)), "utf8"),
);

function basePr(overrides) {
  return {
    labels: ["autonomous:safe"],
    isDraft: false,
    mergeable: "MERGEABLE",
    mergeStateStatus: "CLEAN",
    reviewDecision: "APPROVED",
    statusCheckRollup: [{ name: "verify", conclusion: "SUCCESS" }],
    ...overrides,
  };
}

test("fully green SAFE PR is eligible", () => {
  const { eligible, reasons } = evaluateMergeEligibility(basePr({}), policy);
  assert.equal(eligible, true);
  assert.deepEqual(reasons, []);
});

test("PROTECTED label always blocks, even if everything else is green", () => {
  const { eligible } = evaluateMergeEligibility(
    basePr({ labels: ["autonomous:safe", "autonomous:protected"] }),
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

test("changes requested blocks", () => {
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

test("pending checks block (fail closed, not open)", () => {
  const { eligible } = evaluateMergeEligibility(
    basePr({ statusCheckRollup: [{ name: "verify", conclusion: null }] }),
    policy,
  );
  assert.equal(eligible, false);
});

test("no checks at all blocks", () => {
  const { eligible } = evaluateMergeEligibility(basePr({ statusCheckRollup: [] }), policy);
  assert.equal(eligible, false);
});
