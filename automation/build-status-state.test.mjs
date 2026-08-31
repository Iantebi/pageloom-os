import { test } from "node:test";
import assert from "node:assert/strict";
import { buildState } from "./build-status-state.mjs";

test("found task maps to currentTask", () => {
  const state = buildState(
    { found: true, issueNumber: 5, title: "Fix bug", url: "u", classification: "SAFE", reason: "r" },
    "2026-08-31T00:00:00Z",
  );
  assert.equal(state.currentTask.number, 5);
  assert.equal(state.generatedAt, "2026-08-31T00:00:00Z");
});

test("not found maps to idle with protected candidates surfaced", () => {
  const state = buildState(
    { found: false, protectedCandidates: [{ number: 9, title: "Rotate key", reason: "secrets" }] },
    "2026-08-31T00:00:00Z",
  );
  assert.equal(state.idle, true);
  assert.equal(state.nextCandidates[0].classification, "PROTECTED");
});
