#!/usr/bin/env node
/**
 * Picks up to `policy.maxConcurrentWorkers` SAFE, approved backlog tasks for the
 * Autonomous Development Manager, assigns each an explicit worker role (Developer or
 * Business & Operations — see automation/lib/route.mjs), and hands each off to the
 * EXISTING @claude workflow (.github/workflows/claude.yml) by posting a role-specific
 * trigger comment — this script deliberately does not implement any code itself, so the
 * one already-reviewed execution path (claude.yml) stays the single place that runs Claude
 * Code against the repository. The QA & Safety role is never dispatched from here: it is
 * requested separately, per open worker PR, by dispatch-qa-review.mjs.
 *
 * Concurrency: capacity for this run is `maxConcurrentWorkers - (issues currently labeled
 * autonomous:in-progress)`. This is recomputed fresh from live GitHub state on every run,
 * so the cap holds across runs, not just within one. A task is claimed by adding the
 * autonomous:in-progress label (plus its role label) before returning, so a second run
 * (even if it raced past the workflow-level `concurrency:` group) will see the label and
 * skip it. Two agents are never dispatched onto the same issue for the same reason.
 *
 * Fail-closed: if any in-progress issue is also labeled autonomous:blocked (set by
 * check-merge-eligibility.mjs when its PR's checks keep failing), dispatch capacity for
 * this run drops to zero — no NEW work is started while an existing worker is stuck. The
 * blocked issue itself is left alone; a human decides what to do with it.
 *
 * Usage: node automation/select-next-task.mjs [--repo owner/repo] [--dry-run]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { classify } from "./lib/classify.mjs";
import { determineRole, roleLabel, ROLE_BUSINESS_OPS } from "./lib/route.mjs";
import * as gh from "./lib/gh.mjs";

const POLICY_PATH = fileURLToPath(new URL("./policy.json", import.meta.url));
const BLOCKED_COMMENT_MARKER = "<!-- autonomous-manager:blocked-notice -->";

function priorityRank(labelNames, priorityLabels) {
  const idx = priorityLabels.findIndex((label) => labelNames.includes(label));
  return idx === -1 ? priorityLabels.length : idx; // unlabeled = lowest priority
}

function hasLabel(issue, label) {
  return issue.labels.some((l) => (typeof l === "string" ? l : l.name).toLowerCase() === label);
}

function labelsOf(issue) {
  return issue.labels.map((l) => (typeof l === "string" ? l : l.name).toLowerCase());
}

function alreadyNotifiedBlocked(repo, issueNumber) {
  const comments = gh.listIssueComments(repo, issueNumber);
  return comments.some((c) => c.body?.includes(BLOCKED_COMMENT_MARKER));
}

/**
 * Pure selection: given the full set of approved issues and how many workers are already
 * in progress, decide which additional SAFE tasks (if any) to dispatch this run, and to
 * which role each one goes. No I/O.
 *
 * @param {object[]} issues - result of gh.listApprovedIssues
 * @param {object} policy
 * @param {{inProgressCount?: number, anyBlockedWorker?: boolean}} [options]
 */
export function pickNextTasks(issues, policy, { inProgressCount = 0, anyBlockedWorker = false } = {}) {
  const decisions = issues.map((issue) => ({ issue, decision: classify(issue, policy) }));

  const maxWorkers = policy.maxConcurrentWorkers ?? 2;
  const capacity = anyBlockedWorker ? 0 : Math.max(0, maxWorkers - inProgressCount);

  const candidates = decisions
    .filter(({ issue, decision }) => decision.classification === "SAFE" && !hasLabel(issue, policy.labels.inProgress))
    .map(({ issue, decision }) => ({ issue, decision, role: determineRole(issue, decision, policy) }))
    .sort((a, b) => {
      const pr = priorityRank(labelsOf(a.issue), policy.priorityLabels) - priorityRank(labelsOf(b.issue), policy.priorityLabels);
      if (pr !== 0) return pr;
      return new Date(a.issue.createdAt) - new Date(b.issue.createdAt);
    });

  const picked = candidates.slice(0, capacity);
  const remaining = candidates.slice(capacity);

  return { decisions, candidates, picked, remaining, capacity, maxWorkers };
}

function triggerMessageFor(role, issue, decision, policy) {
  const common = [
    `### 🤖 Autonomous manager: starting this task (role: ${role === ROLE_BUSINESS_OPS ? "Business & Operations Agent" : "Developer Agent"})`,
    "",
    `Classified **SAFE**: ${decision.reason}`,
    "",
  ];

  if (role === ROLE_BUSINESS_OPS) {
    return [
      ...common,
      "@claude Please act as the **Business & Operations Agent** on this approved backlog task:",
      "1. Prepare the repository-based business-process documentation, proposal/template, onboarding, or operational asset described above.",
      "2. Stay within this repository — do not send email, post to any external system, or claim to have contacted anyone. This role has no real integration for external actions; if the task actually requires contacting a person or system outside this repository, STOP and explain why in a comment instead of proceeding.",
      "3. Run all available validation (install, typecheck, lint, test, build) for anything you change.",
      "4. Commit, push a branch, and open a Pull Request referencing this issue (`Fixes #" + issue.number + "`), including a short risk/scope summary.",
      "5. Do NOT merge the PR yourself, and do NOT add any QA/readiness label to your own PR — an independent QA & Safety Agent review is required before this can be considered ready, and a worker never approves its own work.",
      `6. If, while working, you discover this task actually requires a PROTECTED action (money, production/Firebase/cloud, secrets, production infra, customer data, or a destructive operation — see automation/policy.json), STOP that part of the work, explain why in a comment on this issue, and add the \`${policy.labels.protected}\` label instead of proceeding.`,
      "",
      `Label the resulting PR \`${policy.labels.safe}\` once opened, so the independent QA & Safety review and readiness check (see automation/check-merge-eligibility.mjs and automation/dispatch-qa-review.mjs) can consider it.`,
    ].join("\n");
  }

  return [
    ...common,
    "@claude Please act as the **Developer Agent** on this approved backlog task:",
    "1. Implement the change described above.",
    "2. Run all available validation (install, typecheck, lint, test, build).",
    "3. Commit, push a branch, and open a Pull Request referencing this issue (`Fixes #" + issue.number + "`), including a short risk/scope summary.",
    "4. Do NOT merge the PR yourself, and do NOT add any QA/readiness label to your own PR — an independent QA & Safety Agent review is required before this can be considered ready, and a worker never approves its own work.",
    `5. If, while working, you discover this task actually requires a PROTECTED action (money, production/Firebase/cloud, secrets, production infra, customer data, or a destructive operation — see automation/policy.json), STOP that part of the work, explain why in a comment on this issue, and add the \`${policy.labels.protected}\` label instead of proceeding.`,
    "",
    `Label the resulting PR \`${policy.labels.safe}\` once opened, so the independent QA & Safety review and readiness check (see automation/check-merge-eligibility.mjs and automation/dispatch-qa-review.mjs) can consider it.`,
  ].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const repo = args.includes("--repo") ? args[args.indexOf("--repo") + 1] : process.env.GITHUB_REPOSITORY;
  const dryRun = args.includes("--dry-run");

  if (!repo) {
    console.error("Usage: select-next-task.mjs --repo owner/repo [--dry-run]");
    process.exit(2);
  }

  const policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
  const issues = gh.listApprovedIssues(repo, policy.labels.approved);

  const inProgressCount = issues.filter((issue) => hasLabel(issue, policy.labels.inProgress)).length;
  const anyBlockedWorker = issues.some((issue) => hasLabel(issue, policy.labels.inProgress) && hasLabel(issue, policy.labels.blocked));

  const { decisions, picked, remaining, capacity, maxWorkers } = pickNextTasks(issues, policy, { inProgressCount, anyBlockedWorker });

  // Notify (once) on any approved-but-protected issue so Isaac knows it needs a decision,
  // without spamming a comment on every scheduled run.
  for (const { issue, decision } of decisions) {
    if (decision.classification !== "PROTECTED") continue;
    if (hasLabel(issue, policy.labels.blocked)) continue;
    if (!dryRun && alreadyNotifiedBlocked(repo, issue.number)) continue;

    const message = [
      BLOCKED_COMMENT_MARKER,
      "### 🚧 Autonomous manager: human approval required",
      "",
      `This issue is labeled \`${policy.labels.approved}\` but was classified **PROTECTED**, so the autonomous manager will not act on it:`,
      "",
      `> ${decision.reason}`,
      "",
      "If this classification is wrong, adjust the issue text or `automation/policy.json`. Otherwise this task needs Isaac to review and, if appropriate, perform the protected action manually.",
    ].join("\n");

    if (dryRun) {
      console.log(`[dry-run] would label #${issue.number} as blocked and comment:\n${message}\n`);
    } else {
      gh.addLabel(repo, issue.number, policy.labels.blocked);
      gh.commentOnIssue(repo, issue.number, message);
    }
  }

  if (anyBlockedWorker && !dryRun) {
    console.log("[fail-closed] an in-progress worker is labeled blocked (repeated check failures) — dispatch capacity is 0 this run.");
  }

  for (const { issue, decision, role } of picked) {
    const message = triggerMessageFor(role, issue, decision, policy);

    if (dryRun) {
      console.log(`[dry-run] would claim #${issue.number} as ${role} and post:\n${message}\n`);
    } else {
      gh.addLabel(repo, issue.number, policy.labels.inProgress);
      const rLabel = roleLabel(role, policy);
      if (rLabel) gh.addLabel(repo, issue.number, rLabel);
      gh.commentOnIssue(repo, issue.number, message);
    }
  }

  const output = {
    dispatched: picked.map(({ issue, decision, role }) => ({
      issueNumber: issue.number,
      title: issue.title,
      url: issue.url,
      role,
      classification: decision.classification,
      reason: decision.reason,
    })),
    capacityMax: maxWorkers,
    activeWorkers: inProgressCount + picked.length,
    anyBlockedWorker,
    protectedCandidates: decisions
      .filter((d) => d.decision.classification === "PROTECTED" && hasLabel(d.issue, policy.labels.approved))
      .map((d) => ({ number: d.issue.number, title: d.issue.title, reason: d.decision.reason })),
    safeQueueRemaining: remaining.map(({ issue, role }) => ({ number: issue.number, title: issue.title, role })),
  };
  console.log(JSON.stringify(output));
  await writeGithubOutput(output);
}

async function writeGithubOutput(output) {
  if (!process.env.GITHUB_OUTPUT) return;
  const fs = await import("node:fs");
  const delimiter = `EOF_${Math.random().toString(36).slice(2)}`;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `task<<${delimiter}\n${JSON.stringify(output)}\n${delimiter}\n`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
