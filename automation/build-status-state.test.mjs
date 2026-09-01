import { test } from "node:test";
import assert from "node:assert/strict";
import { buildState } from "./build-status-state.mjs";

test("active workers surface as not-idle with the right concurrency numbers", () => {
  const state = buildState(
    { dispatched: [{ issueNumber: 5, title: "Fix bug", url: "u", role: "developer", classification: "SAFE", reason: "r" }], capacityMax: 2, activeWorkers: 1 },
    "2026-08-31T00:00:00Z",
  );
  assert.equal(state.generatedAt, "2026-08-31T00:00:00Z");
  assert.equal(state.idle, false);
  assert.deepEqual(state.concurrency, { active: 1, max: 2 });
});

test("no dispatch maps to idle with protected and safe candidates surfaced", () => {
  const state = buildState(
    {
      dispatched: [],
      capacityMax: 2,
      activeWorkers: 0,
      protectedCandidates: [{ number: 9, title: "Rotate key", reason: "secrets" }],
      safeQueueRemaining: [{ number: 10, title: "Add tests", role: "developer" }],
    },
    "2026-08-31T00:00:00Z",
  );
  assert.equal(state.idle, true);
  assert.equal(state.nextCandidates[0].classification, "PROTECTED");
  assert.equal(state.nextCandidates[1].classification, "SAFE");
  assert.equal(state.nextCandidates[1].role, "developer");
});

test("anyBlockedWorker surfaces as haltedForBlocker", () => {
  const state = buildState(
    { dispatched: [], capacityMax: 2, activeWorkers: 1, anyBlockedWorker: true },
    "2026-08-31T00:00:00Z",
  );
  assert.equal(state.haltedForBlocker, true);
});
