#!/usr/bin/env node
/**
 * Maintains a single pinned "Autonomous Manager Status" issue so Isaac can see, at a
 * glance, what the manager is doing without digging through Actions logs.
 *
 * Usage (from a workflow step):
 *   node automation/report-status.mjs --repo owner/repo --state-file /tmp/state.json
 *
 * The state file is a small JSON object (see `buildStatusBody` below for the shape).
 * `buildStatusBody` is exported and unit-tested separately from the GitHub I/O so the
 * rendering logic can be verified without a live repo.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as gh from "./lib/gh.mjs";

const POLICY_PATH = fileURLToPath(new URL("./policy.json", import.meta.url));

export function buildStatusBody(state, repo) {
  const {
    generatedAt,
    currentTask,
    lastCompleted,
    nextCandidates = [],
    idle = false,
  } = state;

  const lines = [
    "<!-- managed-by: automation/report-status.mjs — do not hand-edit, it will be overwritten -->",
    "# Autonomous Development Manager — Status",
    "",
    `_Last updated: ${generatedAt}_`,
    "",
    "## Currently running",
    "",
  ];

  if (currentTask) {
    lines.push(
      `- **Task:** #${currentTask.number} — ${currentTask.title} (${currentTask.url})`,
      `- **Classification:** ${currentTask.classification} — ${currentTask.reason}`,
      `- **Status:** ${currentTask.status}`,
      currentTask.prUrl ? `- **Pull Request:** ${currentTask.prUrl}` : "- **Pull Request:** not yet created",
      currentTask.ciResult ? `- **CI result:** ${currentTask.ciResult}` : "- **CI result:** pending",
      currentTask.reviewResult ? `- **Review result:** ${currentTask.reviewResult}` : "- **Review result:** pending",
    );
  } else if (idle) {
    lines.push("- No SAFE, approved backlog task is currently running. Idle.");
  }

  lines.push("", "## Last completed", "");
  if (lastCompleted) {
    lines.push(
      `- #${lastCompleted.number} — ${lastCompleted.title}`,
      `- **PR:** ${lastCompleted.prUrl ?? "n/a"}`,
      `- **Outcome:** ${lastCompleted.outcome}`,
      `- **Completed at:** ${lastCompleted.completedAt}`,
    );
  } else {
    lines.push("- Nothing recorded yet.");
  }

  lines.push("", "## Needs Isaac's approval (PROTECTED)", "");
  const protectedCandidates = nextCandidates.filter((c) => c.classification === "PROTECTED");
  if (protectedCandidates.length === 0) {
    lines.push("- None right now.");
  } else {
    for (const c of protectedCandidates) {
      lines.push(`- #${c.number} — ${c.title}: ${c.reason}`);
    }
  }

  lines.push("", "## Up next (SAFE, approved, queued)", "");
  const safeQueue = nextCandidates.filter((c) => c.classification === "SAFE");
  if (safeQueue.length === 0) {
    lines.push("- Nothing queued.");
  } else {
    for (const c of safeQueue) {
      lines.push(`- #${c.number} — ${c.title}`);
    }
  }

  lines.push(
    "",
    "---",
    `_See [docs/AUTONOMOUS-MANAGER.md](https://github.com/${repo}/blob/main/docs/AUTONOMOUS-MANAGER.md) for how this manager decides SAFE vs PROTECTED, and how to add work to its backlog._`,
  );

  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const repoArg = args.includes("--repo") ? args[args.indexOf("--repo") + 1] : process.env.GITHUB_REPOSITORY;
  const stateFileArg = args.includes("--state-file") ? args[args.indexOf("--state-file") + 1] : null;

  if (!repoArg || !stateFileArg) {
    console.error("Usage: report-status.mjs --repo owner/repo --state-file path/to/state.json");
    process.exit(2);
  }

  const policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
  const state = JSON.parse(readFileSync(stateFileArg, "utf8"));
  const body = buildStatusBody(state, repoArg);

  const existing = gh.findIssuesByLabel(repoArg, policy.labels.statusBoard, { limit: 1 });
  if (existing.length > 0) {
    gh.editIssueBody(repoArg, existing[0].number, body);
    console.log(`Updated status board: ${existing[0].url}`);
  } else {
    const number = gh.createIssue(repoArg, {
      title: "🤖 Autonomous Development Manager — Status",
      body,
      labels: [policy.labels.statusBoard],
    });
    console.log(`Created status board issue #${number}`);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
