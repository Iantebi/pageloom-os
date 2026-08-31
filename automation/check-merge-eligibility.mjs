#!/usr/bin/env node
/**
 * Decides whether a PR opened by the autonomous manager may have GitHub's native
 * auto-merge enabled. This is the ONLY place that decision is made, and it fails closed:
 * any missing/ambiguous signal results in NOT eligible.
 *
 * This never bypasses branch protection — `gh pr merge --auto` only queues the merge for
 * when GitHub's own required checks are satisfied; it cannot weaken or skip them.
 *
 * Usage: node automation/check-merge-eligibility.mjs --repo owner/repo --pr 123 [--dry-run]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as gh from "./lib/gh.mjs";

const POLICY_PATH = fileURLToPath(new URL("./policy.json", import.meta.url));

function labelNames(labels) {
  return labels.map((l) => (typeof l === "string" ? l : l.name).toLowerCase());
}

/**
 * @param {object} pr - result of `gh pr view --json mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,labels,isDraft`
 * @param {object} policy
 * @returns {{eligible: boolean, reasons: string[]}}
 */
export function evaluateMergeEligibility(pr, policy) {
  const reasons = [];
  const names = labelNames(pr.labels ?? []);

  if (names.includes(policy.labels.protected)) {
    return { eligible: false, reasons: ["PR is labeled PROTECTED; PROTECTED work must never auto-merge."] };
  }
  if (!names.includes(policy.labels.safe)) {
    return { eligible: false, reasons: [`PR is not labeled "${policy.labels.safe}"; only explicitly SAFE-classified PRs are considered for auto-merge.`] };
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

  return { eligible: reasons.length === 0, reasons };
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

  if (eligible) {
    console.log(`PR #${prNumber} is eligible for auto-merge.`);
    if (dryRun) {
      console.log("[dry-run] would run: gh pr merge --auto --squash --delete-branch");
    } else {
      gh.enableAutoMerge(repo, prNumber);
      console.log("Auto-merge enabled (GitHub will still wait for all required checks/reviews).");
    }
  } else {
    console.log(`PR #${prNumber} is NOT eligible for auto-merge:`);
    for (const reason of reasons) console.log(`  - ${reason}`);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
