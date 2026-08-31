#!/usr/bin/env node
/**
 * Picks the next SAFE, approved backlog task for the Autonomous Development Manager and
 * hands it off to the EXISTING @claude workflow (.github/workflows/claude.yml) by posting
 * a trigger comment — this script deliberately does not implement any code itself, so the
 * one already-reviewed execution path (claude.yml) stays the single place that runs Claude
 * Code against the repository.
 *
 * Concurrency: this script claims a task by adding the `autonomous:in-progress` label
 * before returning, so a second run (even if it raced past the workflow-level
 * `concurrency:` group) will see the label and skip it. It is intentionally NOT safe
 * against two runs claiming the same task in the same instant without that Actions-level
 * concurrency group — see automation/workflow-templates/autonomous-manager.yml.
 *
 * Usage: node automation/select-next-task.mjs [--repo owner/repo] [--dry-run]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { classify } from "./lib/classify.mjs";
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

function alreadyNotifiedBlocked(repo, issueNumber) {
  const comments = gh.listIssueComments(repo, issueNumber);
  return comments.some((c) => c.body?.includes(BLOCKED_COMMENT_MARKER));
}

export function pickNextTask(issues, policy) {
  const decisions = issues.map((issue) => ({ issue, decision: classify(issue, policy) }));

  const safeCandidates = decisions
    .filter(({ issue, decision }) => decision.classification === "SAFE" && !hasLabel(issue, policy.labels.inProgress))
    .sort((a, b) => {
      const pr = priorityRank(a.issue.labels.map((l) => (typeof l === "string" ? l : l.name).toLowerCase()), policy.priorityLabels)
        - priorityRank(b.issue.labels.map((l) => (typeof l === "string" ? l : l.name).toLowerCase()), policy.priorityLabels);
      if (pr !== 0) return pr;
      return new Date(a.issue.createdAt) - new Date(b.issue.createdAt);
    });

  return { decisions, next: safeCandidates[0] ?? null };
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

  const { decisions, next } = pickNextTask(issues, policy);

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

  if (!next) {
    const output = {
      found: false,
      protectedCandidates: decisions
        .filter((d) => d.decision.classification === "PROTECTED" && hasLabel(d.issue, policy.labels.approved))
        .map((d) => ({ number: d.issue.number, title: d.issue.title, reason: d.decision.reason })),
    };
    console.log(JSON.stringify(output));
    await writeGithubOutput(output);
    return;
  }

  const { issue, decision } = next;
  const triggerMessage = [
    "### 🤖 Autonomous manager: starting this task",
    "",
    `Classified **SAFE**: ${decision.reason}`,
    "",
    "@claude Please implement this approved backlog task end-to-end:",
    "1. Implement the change described above.",
    "2. Run all available validation (install, typecheck, lint, test, build).",
    "3. Commit, push a branch, and open a Pull Request referencing this issue (`Fixes #" + issue.number + "`).",
    "4. Do NOT merge the PR yourself.",
    `5. If, while working, you discover this task actually requires a PROTECTED action (money, production/Firebase/cloud, secrets, production infra, customer data, or a destructive operation — see automation/policy.json), STOP that part of the work, explain why in a comment on this issue, and add the \`${policy.labels.protected}\` label instead of proceeding.`,
    "",
    `Label the resulting PR \`${policy.labels.safe}\` once opened, so the autonomous merge-eligibility check (see automation/check-merge-eligibility.mjs) can consider it.`,
  ].join("\n");

  if (dryRun) {
    console.log(`[dry-run] would claim #${issue.number} and post:\n${triggerMessage}\n`);
  } else {
    gh.addLabel(repo, issue.number, policy.labels.inProgress);
    gh.commentOnIssue(repo, issue.number, triggerMessage);
  }

  const output = {
    found: true,
    issueNumber: issue.number,
    title: issue.title,
    url: issue.url,
    classification: decision.classification,
    reason: decision.reason,
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
