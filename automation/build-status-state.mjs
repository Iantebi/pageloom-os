#!/usr/bin/env node
/**
 * Turns the JSON emitted by select-next-task.mjs (via the `task` step output) into the
 * state object report-status.mjs renders onto the pinned status-board issue.
 *
 * Reads the task JSON from the TASK_JSON env var (not argv) so it never has to be
 * shell-escaped/interpolated by the calling workflow step.
 *
 * Usage: TASK_JSON='{"dispatched":[...],...}' node automation/build-status-state.mjs > state.json
 */
export function buildState(taskJson, now = new Date().toISOString()) {
  const protectedCandidates = (taskJson.protectedCandidates ?? []).map((c) => ({
    number: c.number,
    title: c.title,
    classification: "PROTECTED",
    reason: c.reason,
  }));
  const safeQueue = (taskJson.safeQueueRemaining ?? []).map((c) => ({
    number: c.number,
    title: c.title,
    classification: "SAFE",
    role: c.role,
  }));

  return {
    generatedAt: now,
    concurrency: { active: taskJson.activeWorkers ?? 0, max: taskJson.capacityMax ?? 2 },
    haltedForBlocker: taskJson.anyBlockedWorker === true,
    idle: (taskJson.activeWorkers ?? 0) === 0,
    nextCandidates: [...protectedCandidates, ...safeQueue],
  };
}

async function main() {
  const raw = process.env.TASK_JSON;
  if (!raw) {
    console.error("TASK_JSON env var is required");
    process.exit(2);
  }
  const state = buildState(JSON.parse(raw));
  process.stdout.write(JSON.stringify(state, null, 2));
}

import { fileURLToPath } from "node:url";
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
