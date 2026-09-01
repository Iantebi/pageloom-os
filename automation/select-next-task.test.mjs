import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pickNextTasks } from "./select-next-task.mjs";

const policy = JSON.parse(
  readFileSync(fileURLToPath(new URL("./policy.json", import.meta.url)), "utf8"),
);

function issue(overrides) {
  return {
    number: 1,
    title: "Fix a bug",
    body: "bug fix",
    labels: ["autonomous:approved"],
    createdAt: "2026-08-01T00:00:00Z",
    url: "https://github.com/x/y/issues/1",
    ...overrides,
  };
}

test("skips in-progress issues even if otherwise SAFE", () => {
  const { picked } = pickNextTasks(
    [issue({ number: 1, labels: ["autonomous:approved", "autonomous:in-progress"] })],
    policy,
  );
  assert.deepEqual(picked, []);
});

test("prefers higher priority label", () => {
  const { picked } = pickNextTasks(
    [
      issue({ number: 1, labels: ["autonomous:approved", "priority:p3"], createdAt: "2026-08-01T00:00:00Z" }),
      issue({ number: 2, labels: ["autonomous:approved", "priority:p0"], createdAt: "2026-08-02T00:00:00Z" }),
    ],
    policy,
  );
  assert.equal(picked[0].issue.number, 2);
});

test("falls back to oldest first when priority ties", () => {
  const { picked } = pickNextTasks(
    [
      issue({ number: 1, createdAt: "2026-08-02T00:00:00Z" }),
      issue({ number: 2, createdAt: "2026-08-01T00:00:00Z" }),
    ],
    policy,
  );
  assert.equal(picked[0].issue.number, 2);
});

test("never picks a PROTECTED task", () => {
  const { picked } = pickNextTasks(
    [issue({ number: 1, title: "Rotate secret", body: "", labels: ["autonomous:approved"] })],
    policy,
  );
  assert.deepEqual(picked, []);
});

test("assigns the developer role to ordinary code-shaped work", () => {
  const { picked } = pickNextTasks([issue({ number: 1 })], policy);
  assert.equal(picked[0].role, "developer");
});

test("assigns the business-ops role to business-process work", () => {
  const { picked } = pickNextTasks(
    [issue({ number: 1, title: "Draft onboarding checklist", body: "Write an onboarding checklist for new clients." })],
    policy,
  );
  assert.equal(picked[0].role, "business-ops");
});

test("respects max concurrency: caps picks to available capacity", () => {
  const { picked, remaining, capacity } = pickNextTasks(
    [
      issue({ number: 1, createdAt: "2026-08-01T00:00:00Z" }),
      issue({ number: 2, createdAt: "2026-08-02T00:00:00Z" }),
      issue({ number: 3, createdAt: "2026-08-03T00:00:00Z" }),
    ],
    policy,
    { inProgressCount: 0 },
  );
  assert.equal(capacity, 2);
  assert.equal(picked.length, 2);
  assert.equal(remaining.length, 1);
  assert.deepEqual(picked.map((p) => p.issue.number), [1, 2]);
});

test("zero capacity when already at max concurrent workers", () => {
  const { picked, capacity } = pickNextTasks([issue({ number: 1 })], policy, { inProgressCount: 2 });
  assert.equal(capacity, 0);
  assert.deepEqual(picked, []);
});

test("fail-closed: a blocked in-progress worker halts all new dispatch", () => {
  const { picked, capacity } = pickNextTasks(
    [issue({ number: 1 })],
    policy,
    { inProgressCount: 1, anyBlockedWorker: true },
  );
  assert.equal(capacity, 0);
  assert.deepEqual(picked, []);
});

test("duplicate-work prevention: the same issue is never returned twice across picked+remaining", () => {
  const { picked, remaining } = pickNextTasks(
    [issue({ number: 1 }), issue({ number: 2 }), issue({ number: 3 })],
    policy,
    { inProgressCount: 0 },
  );
  const numbers = [...picked, ...remaining].map((p) => p.issue.number);
  assert.equal(new Set(numbers).size, numbers.length);
});
