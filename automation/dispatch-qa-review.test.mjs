import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { selectPrsNeedingQaRequest } from "./dispatch-qa-review.mjs";

const policy = JSON.parse(
  readFileSync(fileURLToPath(new URL("./policy.json", import.meta.url)), "utf8"),
);

function pr(overrides) {
  return {
    number: 1,
    title: "Fix a bug",
    url: "https://github.com/x/y/pull/1",
    body: "Fixes #1",
    labels: ["autonomous:safe"],
    isDraft: false,
    ...overrides,
  };
}

test("a fresh SAFE PR needs a QA request", () => {
  const selected = selectPrsNeedingQaRequest([pr({})], policy);
  assert.equal(selected.length, 1);
});

test("a draft PR is skipped", () => {
  const selected = selectPrsNeedingQaRequest([pr({ isDraft: true })], policy);
  assert.deepEqual(selected, []);
});

test("a PR already requested is skipped (idempotent)", () => {
  const selected = selectPrsNeedingQaRequest([pr({ labels: ["autonomous:safe", "autonomous:qa-requested"] })], policy);
  assert.deepEqual(selected, []);
});

test("a PR already QA-passed is skipped", () => {
  const selected = selectPrsNeedingQaRequest([pr({ labels: ["autonomous:safe", "autonomous:qa-passed"] })], policy);
  assert.deepEqual(selected, []);
});

test("a PR with QA changes-requested is skipped (waits for developer fixes, not a new request)", () => {
  const selected = selectPrsNeedingQaRequest([pr({ labels: ["autonomous:safe", "autonomous:qa-changes-requested"] })], policy);
  assert.deepEqual(selected, []);
});

test("a PROTECTED-labeled PR is never sent to QA", () => {
  const selected = selectPrsNeedingQaRequest([pr({ labels: ["autonomous:safe", "autonomous:protected"] })], policy);
  assert.deepEqual(selected, []);
});

test("multiple eligible PRs are all selected", () => {
  const selected = selectPrsNeedingQaRequest([pr({ number: 1 }), pr({ number: 2 })], policy);
  assert.equal(selected.length, 2);
});
