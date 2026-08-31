import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pickNextTask } from "./select-next-task.mjs";

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
  const { next } = pickNextTask(
    [issue({ number: 1, labels: ["autonomous:approved", "autonomous:in-progress"] })],
    policy,
  );
  assert.equal(next, null);
});

test("prefers higher priority label", () => {
  const { next } = pickNextTask(
    [
      issue({ number: 1, labels: ["autonomous:approved", "priority:p3"], createdAt: "2026-08-01T00:00:00Z" }),
      issue({ number: 2, labels: ["autonomous:approved", "priority:p0"], createdAt: "2026-08-02T00:00:00Z" }),
    ],
    policy,
  );
  assert.equal(next.issue.number, 2);
});

test("falls back to oldest first when priority ties", () => {
  const { next } = pickNextTask(
    [
      issue({ number: 1, createdAt: "2026-08-02T00:00:00Z" }),
      issue({ number: 2, createdAt: "2026-08-01T00:00:00Z" }),
    ],
    policy,
  );
  assert.equal(next.issue.number, 2);
});

test("never returns a PROTECTED task", () => {
  const { next } = pickNextTask(
    [issue({ number: 1, title: "Rotate secret", body: "", labels: ["autonomous:approved"] })],
    policy,
  );
  assert.equal(next, null);
});
