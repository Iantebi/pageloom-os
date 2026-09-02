#!/usr/bin/env node
/**
 * Decides whether a PR opened by the autonomous manager is ready for Isaac to merge by
 * hand. This is the ONLY place that readiness decision is made, and it fails closed: any
 * missing/ambiguous signal results in NOT ready.
 *
 * There is deliberately no auto-merge path anywhere in this file, or anywhere else in
 * this repository's automation: this script never runs `gh pr merge`. When a PR is ready,
 * it is labeled autonomous:ready-for-merge and a comment is posted — merging itself always
 * remains a manual action Isaac takes in the GitHub UI/CLI.
 *
 * This also watches for repeated CI failures on in-progress worker PRs (a fail-closed
 * safeguard): if a PR's checks have failed, its linked issue is labeled autonomous:blocked,
 * which select-next-task.mjs reads to stop dispatching NEW work until a human resolves it.
 * The label is removed automatically if the checks later turn green.
 *
 * Usage: node automation/check-merge-eligibility.mjs --repo owner/repo --pr 123 [--dry-run]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as gh from "./lib/gh.mjs";

const POLICY_PATH = fileURLToPath(new URL("./policy.json", import.meta.url));
const READY_COMMENT_MARKER = "<!-- autonomous-manager:ready-for-merge-notice -->";
const BLOCKED_COMMENT_MARKER = "<!-- autonomous-manager:worker-health-blocked-notice -->";

function labelNames(labels) {
  return labels.map((l) => (typeof l === "string" ? l : l.name).toLowerCase());
}

function hasLabel(pr, label) {
  return labelNames(pr.labels ?? []).includes(label);
}

/**
 * @param {object} pr - result of gh.viewPr
 * @param {object} policy
 * @returns {{eligible: boolean, reasons: string[]}}
 */
export function evaluateMergeEligibility(pr, policy) {
  const reasons = [];
  const names = labelNames(pr.labels ?? []);

  if (names.includes(policy.labels.protected)) {
    return { eligible: false, reasons: ["PR is labeled PROTECTED; PROTECTED work must never be marked ready for merge."] };
  }
  if (!names.includes(policy.labels.safe)) {
    return { eligible: false, reasons: [`PR is not labeled "${policy.labels.safe}"; only explicitly SAFE-classified PRs are considered.`] };
  }
  if (pr.isDraft) {
    reasons.push("PR is still a draft.");
  }
  if (pr.mergeable !== "MERGEABLE") {
    reasons.push(`PR mergeable state is "${pr.mergeable}" (expected MERGEABLE) — likely a conflict.`);
  }
  if (pr.mergeStateStatus !== "CLEAN" && pr.mergeStateStatus !== "HAS_HOOKS") {
    reasons.push(`PR mergeStateStatus is "${pr.mergeStateStatus}" (expected CLEAN) — required checks/reviews not satisfied yet.`);
  }
  if (pr.reviewDecision === "CHANGES_REQUESTED") {
    reasons.push("A review has requested changes.");
  }
  if (pr.reviewDecision === "REVIEW_REQUIRED") {
    reasons.push("A required review has not been submitted yet.");
  }
  const checks = pr.statusCheckRollup ?? [];
  if (checks.length === 0) {
    reasons.push("No status checks have reported yet.");
  }
  const notPassed = checks.filter((c) => {
    const conclusion = c.conclusion ?? c.state;
    return conclusion && !["SUCCESS", "NEUTRAL", "SKIPPED"].includes(conclusion);
  });
  if (notPassed.length > 0) {
    reasons.push(`${notPassed.length} check(s) have not succeeded: ${notPassed.map((c) => c.name ?? c.context).join(", ")}`);
  }
  const pending = checks.filter((c) => {
    const conclusion = c.conclusion ?? c.state;
    return !conclusion;
  });
  if (pending.length > 0) {
    reasons.push(`${pending.length} check(s) are still pending.`);
  }

  if (names.includes(policy.labels.qaChangesRequested)) {
    reasons.push(`Independent QA/Safety review requested changes ("${policy.labels.qaChangesRequested}" is present); not ready until re-reviewed.`);
  }
  if (!names.includes(policy.labels.qaPassed)) {
    reasons.push(`Independent QA/Safety review has not passed yet (missing "${policy.labels.qaPassed}" label). A worker never approves its own work.`);
  }

  return { eligible: reasons.length === 0, reasons };
}

/**
 * Fail-closed worker-health check: has this PR's CI actually failed (not merely pending)?
 * @param {object} pr - result of gh.viewPr
 * @returns {{healthy: boolean, failingChecks: string[]}}
 */
export function evaluateWorkerHealth(pr) {
  const checks = pr.statusCheckRollup ?? [];
  const failing = checks.filter((c) => {
    const conclusion = c.conclusion ?? c.state;
    return conclusion && !["SUCCESS", "NEUTRAL", "SKIPPED"].includes(conclusion);
  });
  return { healthy: failing.length === 0, failingChecks: failing.map((c) => c.name ?? c.context) };
}

function linkedIssueNumber(pr) {
  const match = (pr.body ?? "").match(/#(\d+)/);
  return match ? Number(match[1]) : null;
}

function alreadyCommented(repo, prNumber, marker) {
  return gh.listPrComments(repo, prNumber).some((c) => c.body?.includes(marker));
}

async function main() {
  const args = process.argv.slice(2);
  const repo = args.includes("--repo") ? args[args.indexOf("--repo") + 1] : process.env.GITHUB_REPOSITORY;
  const prNumber = args.includes("--pr") ? args[args.indexOf("--pr") + 1] : null;
  const dryRun = args.includes("--dry-run");

  if (!repo || !prNumber) {
    console.error("Usage: check-merge-eligibility.mjs --repo owner/repo --pr <number> [--dry-run]");
    process.exit(2);
  }

  const policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
  const pr = gh.viewPr(repo, prNumber);
  const { eligible, reasons } = evaluateMergeEligibility(pr, policy);
  const { healthy, failingChecks } = evaluateWorkerHealth(pr);
  const issueNumber = linkedIssueNumber(pr);

  if (eligible) {
    console.log(`PR #${prNumber} is ready for Isaac to merge by hand (no auto-merge is ever performed).`);
    if (!hasLabel(pr, policy.labels.readyForMerge)) {
      if (dryRun) {
        console.log(`[dry-run] would label #${prNumber} "${policy.labels.readyForMerge}" and comment.`);
      } else {
        gh.addLabel(repo, prNumber, policy.labels.readyForMerge);
        if (!alreadyCommented(repo, prNumber, READY_COMMENT_MARKER)) {
          gh.commentOnPr(repo, prNumber, [
            READY_COMMENT_MARKER,
            "### ✅ Ready for Isaac's manual merge",
            "",
            "CI is green and the independent QA/Safety review passed. This PR is not merged automatically — merging remains Isaac's explicit action.",
          ].join("\n"));
        }
      }
    }
  } else {
    console.log(`PR #${prNumber} is NOT ready for merge:`);
    for (const reason of reasons) console.log(`  - ${reason}`);
  }

  if (issueNumber !== null) {
    if (!healthy) {
      console.log(`[fail-closed] PR #${prNumber} has failing check(s): ${failingChecks.join(", ")} — blocking new dispatch via issue #${issueNumber}.`);
      if (!dryRun) {
        gh.addLabel(repo, issueNumber, policy.labels.blocked);
        if (!alreadyCommented(repo, prNumber, BLOCKED_COMMENT_MARKER)) {
          gh.commentOnPr(repo, prNumber, [
            BLOCKED_COMMENT_MARKER,
            "### 🚧 Autonomous manager: repeated check failures",
            "",
            `Check(s) failing: ${failingChecks.join(", ")}.`,
            "",
            `The linked issue (#${issueNumber}) has been labeled \`${policy.labels.blocked}\`, which pauses NEW autonomous dispatch until this is fixed or a human intervenes. This PR itself is untouched.`,
          ].join("\n"));
        }
      }
    } else if (dryRun) {
      console.log(`[dry-run] PR #${prNumber} checks are healthy; would ensure issue #${issueNumber} is not blocked on this PR's account.`);
    } else {
      try {
        gh.removeLabel(repo, issueNumber, policy.labels.blocked);
      } catch {
        // Label wasn't present — nothing to clear.
      }
    }
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
