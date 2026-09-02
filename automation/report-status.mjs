#!/usr/bin/env node
/**
 * Maintains a single pinned "Autonomous Manager Status" issue so Isaac can see, at a
 * glance, what every agent is doing without digging through Actions logs — the shared
 * status board / audit trail required by the multi-agent orchestration layer.
 *
 * Usage (from a workflow step):
 *   node automation/report-status.mjs --repo owner/repo --state-file /tmp/state.json
 *
 * The state file is the JSON produced by build-status-state.mjs (queue/candidate/
 * concurrency info derived from the latest dispatch run). This script additionally makes a
 * small, bounded number of *live* read calls (one per currently in-progress issue, capped
 * at maxConcurrentWorkers + a small buffer) to attach each active worker's role, PR, CI,
 * and QA/Safety state — so "currently running" reflects live GitHub state, not just what
 * happened to be dispatched in the run that produced the state file.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as gh from "./lib/gh.mjs";

const POLICY_PATH = fileURLToPath(new URL("./policy.json", import.meta.url));

function labelNames(labels = []) {
  return labels.map((l) => (typeof l === "string" ? l : l.name).toLowerCase());
}

function roleFromLabels(labels, policy) {
  const names = labelNames(labels);
  if (names.includes(policy.labels.roleBusinessOps)) return "business-ops";
  if (names.includes(policy.labels.roleDeveloper)) return "developer";
  return "unassigned";
}

/**
 * Pure: summarize a live PR (gh.viewPr shape) into the fields the status board needs.
 * @param {object} pr
 * @param {object} policy
 */
export function summarizePr(pr, policy) {
  const names = labelNames(pr.labels ?? []);
  const checks = pr.statusCheckRollup ?? [];
  const failing = checks.some((c) => {
    const conclusion = c.conclusion ?? c.state;
    return conclusion && !["SUCCESS", "NEUTRAL", "SKIPPED"].includes(conclusion);
  });
  const pending = checks.length === 0 || checks.some((c) => !(c.conclusion ?? c.state));
  const ciResult = failing ? "failing" : pending ? "pending" : "passing";

  let qaResult = "not requested";
  if (names.includes(policy.labels.qaPassed)) qaResult = "passed";
  else if (names.includes(policy.labels.qaChangesRequested)) qaResult = "changes requested";
  else if (names.includes(policy.labels.qaRequested)) qaResult = "requested";

  return {
    url: pr.url,
    isDraft: !!pr.isDraft,
    ciResult,
    reviewResult: pr.reviewDecision ?? "pending",
    qaResult,
    readyForMerge: names.includes(policy.labels.readyForMerge),
  };
}

/**
 * Pure: given a worker (with role and, if a PR exists, its summarized state), compute the
 * single "what happens next" line for the status board.
 * @param {{role: string, pr: ReturnType<typeof summarizePr>|null}} worker
 */
export function computeNextAction(worker) {
  const { pr } = worker;
  if (!pr) return `Waiting for the ${worker.role} agent to open a PR`;
  if (pr.isDraft) return "PR is a draft — waiting for it to be marked ready for review";
  if (pr.ciResult === "failing") return "CI is failing — blocked until fixed (new dispatch is paused while this stays unresolved)";
  if (pr.ciResult === "pending") return "Waiting for CI to finish";
  if (pr.reviewResult === "CHANGES_REQUESTED") return "Changes requested in review — waiting for fixes";
  if (pr.qaResult === "changes requested") return "QA/Safety review requested changes — waiting for fixes and re-review";
  if (pr.qaResult === "not requested") return "Waiting for the independent QA & Safety review to be requested";
  if (pr.qaResult === "requested") return "Waiting for the independent QA & Safety review";
  if (pr.readyForMerge) return "Ready for Isaac's manual merge (no auto-merge is ever performed)";
  return "Waiting on remaining readiness checks";
}

export function buildStatusBody(state, repo) {
  const {
    generatedAt,
    concurrency = { active: 0, max: 2 },
    workers = [],
    lastCompleted,
    nextCandidates = [],
    idle = false,
    haltedForBlocker = false,
  } = state;

  const lines = [
    "<!-- managed-by: automation/report-status.mjs — do not hand-edit, it will be overwritten -->",
    "# Autonomous Development Manager — Status",
    "",
    `_Last updated: ${generatedAt}_`,
    "",
    `## Concurrency`,
    "",
    `- **Active worker tasks:** ${concurrency.active} / ${concurrency.max}`,
  ];
  if (haltedForBlocker) {
    lines.push("- ⚠️ **New dispatch is paused** — an in-progress worker is blocked (see below). No new SAFE tasks will be started until this is resolved.");
  }

  lines.push("", "## Active worker tasks (Developer / Business & Operations)", "");
  if (workers.length === 0) {
    lines.push(idle ? "- No worker is currently running. Idle." : "- None currently tracked.");
  } else {
    for (const w of workers) {
      lines.push(`- **#${w.number} — ${w.title}** (${w.url})`);
      lines.push(`  - Role: ${w.role}`);
      lines.push(`  - Pull Request: ${w.pr ? w.pr.url : "not yet created"}`);
      if (w.pr) {
        lines.push(`  - CI: ${w.pr.ciResult} · Review: ${w.pr.reviewResult} · QA/Safety: ${w.pr.qaResult}`);
      }
      lines.push(`  - Next action: ${computeNextAction(w)}`);
    }
  }

  lines.push("", "## Last completed", "");
  if (lastCompleted) {
    lines.push(
      `- #${lastCompleted.number} — ${lastCompleted.title}`,
      `- **URL:** ${lastCompleted.url ?? "n/a"}`,
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
      lines.push(`- #${c.number} — ${c.title}${c.role ? ` (role: ${c.role})` : ""}`);
    }
  }

  lines.push(
    "",
    "---",
    `_See [docs/AUTONOMOUS-MANAGER.md](https://github.com/${repo}/blob/main/docs/AUTONOMOUS-MANAGER.md) for how this manager decides SAFE vs PROTECTED and routes work across agent roles, and how to add work to its backlog._`,
  );

  return lines.join("\n");
}

function liveWorkers(repo, policy) {
  const inProgress = gh.findIssuesByLabel(repo, policy.labels.inProgress, {
    state: "open",
    limit: (policy.maxConcurrentWorkers ?? 2) + 10,
    fields: "number,title,url,labels",
  });

  return inProgress.map((issue) => {
    const role = roleFromLabels(issue.labels, policy);
    const openPr = gh.findOpenPrForIssue(repo, issue.number);
    const pr = openPr ? summarizePr(gh.viewPr(repo, openPr.number), policy) : null;
    return { number: issue.number, title: issue.title, url: issue.url, role, pr };
  });
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
  state.workers = liveWorkers(repoArg, policy);
  state.lastCompleted = gh.findLastCompletedIssue(repoArg, policy.labels.done);

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
