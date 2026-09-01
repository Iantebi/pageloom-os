import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildStatusBody, summarizePr, computeNextAction } from "./report-status.mjs";

const policy = JSON.parse(
  readFileSync(fileURLToPath(new URL("./policy.json", import.meta.url)), "utf8"),
);

test("idle state with no workers renders idle", () => {
  const body = buildStatusBody({ generatedAt: "2026-08-31T00:00:00Z", idle: true, workers: [], nextCandidates: [] }, "Iantebi/pageloom-os");
  assert.match(body, /Idle\./);
  assert.match(body, /Nothing recorded yet\./);
});

test("active workers render role, PR status, and next action", () => {
  const body = buildStatusBody({
    generatedAt: "2026-08-31T00:00:00Z",
    concurrency: { active: 1, max: 2 },
    workers: [
      {
        number: 42,
        title: "Fix flaky test",
        url: "https://github.com/x/y/issues/42",
        role: "developer",
        pr: null,
      },
    ],
    nextCandidates: [
      { number: 43, title: "Rotate secret", classification: "PROTECTED", reason: "Matched protected category secrets." },
      { number: 44, title: "Add tests", classification: "SAFE", role: "developer" },
    ],
  }, "Iantebi/pageloom-os");
  assert.match(body, /#42 — Fix flaky test/);
  assert.match(body, /Role: developer/);
  assert.match(body, /not yet created/);
  assert.match(body, /Waiting for the developer agent to open a PR/);
  assert.match(body, /#43 — Rotate secret: Matched protected category secrets\./);
  assert.match(body, /#44 — Add tests \(role: developer\)/);
  assert.match(body, /Active worker tasks:\*\* 1 \/ 2/);
});

test("halted-for-blocker surfaces a warning", () => {
  const body = buildStatusBody({ generatedAt: "t", concurrency: { active: 1, max: 2 }, workers: [], haltedForBlocker: true, nextCandidates: [] }, "x/y");
  assert.match(body, /New dispatch is paused/);
});

test("summarizePr: green everything with QA passed", () => {
  const pr = summarizePr({
    url: "u",
    isDraft: false,
    labels: ["autonomous:safe", "autonomous:qa-passed", "autonomous:ready-for-merge"],
    reviewDecision: "APPROVED",
    statusCheckRollup: [{ name: "verify", conclusion: "SUCCESS" }],
  }, policy);
  assert.equal(pr.ciResult, "passing");
  assert.equal(pr.qaResult, "passed");
  assert.equal(pr.readyForMerge, true);
});

test("summarizePr: failing check", () => {
  const pr = summarizePr({
    url: "u",
    labels: ["autonomous:safe"],
    statusCheckRollup: [{ name: "verify", conclusion: "FAILURE" }],
  }, policy);
  assert.equal(pr.ciResult, "failing");
});

test("computeNextAction: no PR yet", () => {
  assert.equal(computeNextAction({ role: "developer", pr: null }), "Waiting for the developer agent to open a PR");
});

test("computeNextAction: CI failing takes priority", () => {
  const action = computeNextAction({ role: "developer", pr: { isDraft: false, ciResult: "failing", reviewResult: "APPROVED", qaResult: "passed", readyForMerge: false } });
  assert.match(action, /CI is failing/);
});

test("computeNextAction: ready for merge once everything passes", () => {
  const action = computeNextAction({ role: "developer", pr: { isDraft: false, ciResult: "passing", reviewResult: "APPROVED", qaResult: "passed", readyForMerge: true } });
  assert.match(action, /Ready for Isaac's manual merge/);
});

test("computeNextAction: waiting for QA request", () => {
  const action = computeNextAction({ role: "developer", pr: { isDraft: false, ciResult: "passing", reviewResult: "APPROVED", qaResult: "not requested", readyForMerge: false } });
  assert.match(action, /QA & Safety review to be requested/);
});
