import test from "node:test";
import assert from "node:assert/strict";
import { classify, selectNextTask, loadPolicy } from "./manager.mjs";

const policy = loadPolicy();

test("approved, ordinary bug-fix task classifies SAFE", () => {
  const result = classify(policy, {
    title: "Fix off-by-one error in pagination",
    body: "The last page of results is dropped. Add a regression test.",
    labels: ["backlog:approved", "priority:p1"],
  });
  assert.equal(result.classification, "SAFE");
});

test("task without the approved-backlog label defaults to PROTECTED", () => {
  const result = classify(policy, {
    title: "Fix off-by-one error in pagination",
    body: "The last page of results is dropped.",
    labels: [],
  });
  assert.equal(result.classification, "PROTECTED");
});

test("task mentioning production Firebase deploy is PROTECTED even if approved", () => {
  const result = classify(policy, {
    title: "Ship the new pricing page",
    body: "Run firebase deploy --only hosting once merged.",
    labels: ["backlog:approved"],
  });
  assert.equal(result.classification, "PROTECTED");
  assert.match(result.reasons.join(" "), /firebase-cloud-production/);
});

test("task mentioning billing/refunds is PROTECTED", () => {
  const result = classify(policy, {
    title: "Automate refund handling",
    body: "When a customer disputes a charge, issue a refund automatically.",
    labels: ["backlog:approved"],
  });
  assert.equal(result.classification, "PROTECTED");
  assert.match(result.reasons.join(" "), /money/);
});

test("task mentioning secrets/credentials is PROTECTED", () => {
  const result = classify(policy, {
    title: "Rotate the Stripe API key",
    body: "Generate a new access token and update it.",
    labels: ["backlog:approved"],
  });
  assert.equal(result.classification, "PROTECTED");
});

test("a diff touching .github/workflows is PROTECTED regardless of description", () => {
  const result = classify(policy, {
    title: "Improve test coverage",
    body: "Add more unit tests.",
    labels: ["backlog:approved"],
    changedPaths: [".github/workflows/ci.yml"],
  });
  assert.equal(result.classification, "PROTECTED");
});

test("explicit protected label always wins", () => {
  const result = classify(policy, {
    title: "Refactor helper function",
    body: "Pure refactor, no behavior change.",
    labels: ["backlog:approved", "needs-human-approval"],
  });
  assert.equal(result.classification, "PROTECTED");
});

test("selectNextTask skips protected issues and picks the highest-priority safe one", () => {
  const issues = [
    {
      number: 1,
      title: "Rotate API keys",
      body: "Rotate the production API key.",
      labels: ["backlog:approved", "priority:p0"],
      created_at: "2026-08-01T00:00:00Z",
    },
    {
      number: 2,
      title: "Add tests for the CSV import parser",
      body: "Improve unit test coverage for the CSV import parser utility.",
      labels: ["backlog:approved", "priority:p1"],
      created_at: "2026-08-02T00:00:00Z",
    },
    {
      number: 3,
      title: "Fix flaky test",
      body: "The retry test is flaky under load.",
      labels: ["backlog:approved", "priority:p2"],
      created_at: "2026-08-03T00:00:00Z",
    },
  ];

  const result = selectNextTask(policy, issues);
  assert.equal(result.next.issue.number, 2);
  assert.equal(result.next.classification, "SAFE");
  assert.equal(result.skippedProtected.length, 1);
  assert.equal(result.skippedProtected[0].issue.number, 1);
});

test("selectNextTask ignores issues without the approved-backlog label or already locked", () => {
  const issues = [
    { number: 1, title: "Random idea", body: "no label", labels: [], created_at: "2026-08-01T00:00:00Z" },
    {
      number: 2,
      title: "In progress already",
      body: "safe task",
      labels: ["backlog:approved", "autopilot:in-progress"],
      created_at: "2026-08-01T00:00:00Z",
    },
  ];
  const result = selectNextTask(policy, issues);
  assert.equal(result.next, null);
  assert.equal(result.considered.length, 0);
});

test("selectNextTask returns null with no eligible issues", () => {
  const result = selectNextTask(policy, []);
  assert.equal(result.next, null);
  assert.deepEqual(result.skippedProtected, []);
});
