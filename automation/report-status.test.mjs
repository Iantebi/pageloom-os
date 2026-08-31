import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStatusBody } from "./report-status.mjs";

test("idle state renders with no current task", () => {
  const body = buildStatusBody({ generatedAt: "2026-08-31T00:00:00Z", idle: true, nextCandidates: [] }, "Iantebi/pageloom-os");
  assert.match(body, /Idle\./);
  assert.match(body, /Nothing recorded yet\./);
});

test("current task renders classification and PR status", () => {
  const body = buildStatusBody({
    generatedAt: "2026-08-31T00:00:00Z",
    currentTask: {
      number: 42,
      title: "Fix flaky test",
      url: "https://github.com/x/y/issues/42",
      classification: "SAFE",
      reason: "Matched safe category ci-fix.",
      status: "implementing",
    },
    nextCandidates: [
      { number: 43, title: "Rotate secret", classification: "PROTECTED", reason: "Matched protected category secrets." },
      { number: 44, title: "Add tests", classification: "SAFE", reason: "Matched safe category tests." },
    ],
  }, "Iantebi/pageloom-os");
  assert.match(body, /#42 — Fix flaky test/);
  assert.match(body, /SAFE — Matched safe category ci-fix\./);
  assert.match(body, /not yet created/);
  assert.match(body, /#43 — Rotate secret: Matched protected category secrets\./);
  assert.match(body, /#44 — Add tests/);
});
