#!/usr/bin/env node
/**
 * Requests an independent QA & Safety Agent review on every open worker PR that doesn't
 * have one yet — this is the mechanism behind acceptance criterion "Developer output
 * cannot be marked ready until independent QA/Safety review passes."
 *
 * Like select-next-task.mjs, this script does not review anything itself: it posts an
 * "@claude" comment on the PR (issue_comment fires for PR comments too, so the existing
 * .github/workflows/claude.yml pipeline picks it up exactly as it does for issues) asking
 * for a *fresh*, independent Claude Code session — never the same session that opened the
 * PR — to review it against a QA/Safety checklist and record its verdict as a label. This
 * is what makes "a worker never approves its own work" hold in practice: the developer/
 * business-ops trigger comment never grants permission to add a QA label, only this
 * separate request does.
 *
 * Idempotency/claim: a PR is marked "requested" by adding autonomous:qa-requested
 * immediately after the comment is posted, so a second run never asks twice.
 *
 * Usage: node automation/dispatch-qa-review.mjs [--repo owner/repo] [--dry-run]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as gh from "./lib/gh.mjs";

const POLICY_PATH = fileURLToPath(new URL("./policy.json", import.meta.url));

function labelNames(pr) {
  return (pr.labels ?? []).map((l) => (typeof l === "string" ? l : l.name).toLowerCase());
}

/**
 * Pure selection: which open, SAFE-labeled PRs still need a QA & Safety review requested?
 * No I/O.
 *
 * @param {object[]} prs - result of gh.listOpenPrsByLabel(repo, policy.labels.safe)
 * @param {object} policy
 * @returns {object[]}
 */
export function selectPrsNeedingQaRequest(prs, policy) {
  return prs.filter((pr) => {
    if (pr.isDraft) return false;
    const names = labelNames(pr);
    if (names.includes(policy.labels.protected)) return false;
    if (names.includes(policy.labels.qaRequested)) return false;
    if (names.includes(policy.labels.qaPassed)) return false;
    if (names.includes(policy.labels.qaChangesRequested)) return false;
    return true;
  });
}

function qaTriggerMessage(pr, policy) {
  return [
    "### 🔎 Autonomous manager: independent QA & Safety review requested",
    "",
    "@claude Please act as the **QA & Safety Agent** on this pull request, in a fresh session independent of whoever opened it:",
    "1. Review the diff for scope creep (does it match the linked issue, nothing more?), test coverage, regressions, tenant isolation, and this repository's SAFE/PROTECTED and production-deployment safety requirements (see `CLAUDE.md` and `automation/policy.json`).",
    "2. Do not trust the PR description alone — read the actual diff.",
    `3. If it passes, add the \`${policy.labels.qaPassed}\` label. If it does not, add the \`${policy.labels.qaChangesRequested}\` label and leave a comment explaining exactly what must change.`,
    "4. Never approve your own work — only add a QA label here if this review is independent of the implementation.",
    "5. Do NOT merge this PR under any circumstances, and do NOT enable auto-merge — there is no automatic merge path in this repository; merging is Isaac's explicit, manual action.",
    "",
    `This is separate from (and in addition to) the automatic \`claude-code-review.yml\` code review already run on this PR.`,
  ].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const repo = args.includes("--repo") ? args[args.indexOf("--repo") + 1] : process.env.GITHUB_REPOSITORY;
  const dryRun = args.includes("--dry-run");

  if (!repo) {
    console.error("Usage: dispatch-qa-review.mjs --repo owner/repo [--dry-run]");
    process.exit(2);
  }

  const policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
  const prs = gh.listOpenPrsByLabel(repo, policy.labels.safe);
  const needsQa = selectPrsNeedingQaRequest(prs, policy);

  for (const pr of needsQa) {
    const message = qaTriggerMessage(pr, policy);
    if (dryRun) {
      console.log(`[dry-run] would request QA review on PR #${pr.number} and label it "${policy.labels.qaRequested}".`);
    } else {
      gh.commentOnPr(repo, pr.number, message);
      gh.addLabel(repo, pr.number, policy.labels.qaRequested);
    }
  }

  console.log(JSON.stringify({ requested: needsQa.map((pr) => ({ number: pr.number, title: pr.title, url: pr.url })) }));
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
