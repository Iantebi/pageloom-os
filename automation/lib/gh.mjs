/**
 * Minimal, safe wrapper around the `gh` CLI for the Autonomous Development Manager.
 *
 * Uses execFileSync (never a shell string) so issue/PR titles and bodies containing
 * quotes, backticks, or `$(...)` can never be interpreted as shell syntax.
 */
import { execFileSync } from "node:child_process";

function run(args, options = {}) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
}

export function listApprovedIssues(repo, approvedLabel) {
  const out = run([
    "issue", "list",
    "--repo", repo,
    "--label", approvedLabel,
    "--state", "open",
    "--json", "number,title,body,labels,createdAt,url",
    "--limit", "200",
  ]);
  return JSON.parse(out);
}

export function findIssuesByLabel(repo, label, { state = "open", limit = 5 } = {}) {
  const out = run([
    "issue", "list",
    "--repo", repo,
    "--label", label,
    "--state", state,
    "--json", "number,title,url",
    "--limit", String(limit),
  ]);
  return JSON.parse(out);
}

export function addLabel(repo, issueNumber, label) {
  run(["issue", "edit", String(issueNumber), "--repo", repo, "--add-label", label]);
}

export function removeLabel(repo, issueNumber, label) {
  run(["issue", "edit", String(issueNumber), "--repo", repo, "--remove-label", label]);
}

export function commentOnIssue(repo, issueNumber, body) {
  run(["issue", "comment", String(issueNumber), "--repo", repo, "--body", body]);
}

export function listIssueComments(repo, issueNumber) {
  const out = run([
    "issue", "view", String(issueNumber),
    "--repo", repo,
    "--json", "comments",
  ]);
  return JSON.parse(out).comments ?? [];
}

export function createIssue(repo, { title, body, labels = [] }) {
  const args = ["issue", "create", "--repo", repo, "--title", title, "--body", body];
  for (const label of labels) args.push("--label", label);
  const out = run(args);
  const match = out.trim().match(/\/issues\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function editIssueBody(repo, issueNumber, body) {
  run(["issue", "edit", String(issueNumber), "--repo", repo, "--body", body]);
}

export function findOpenPrForIssue(repo, issueNumber) {
  const out = run([
    "pr", "list",
    "--repo", repo,
    "--state", "open",
    "--search", `${issueNumber} in:body`,
    "--json", "number,title,url,body",
    "--limit", "20",
  ]);
  const prs = JSON.parse(out);
  const refPattern = new RegExp(`#${issueNumber}\\b`);
  return prs.find((pr) => refPattern.test(pr.body ?? "")) ?? null;
}

export function viewPr(repo, prNumber) {
  const out = run([
    "pr", "view", String(prNumber),
    "--repo", repo,
    "--json", "number,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,labels,isDraft,title,url",
  ]);
  return JSON.parse(out);
}

export function enableAutoMerge(repo, prNumber) {
  run(["pr", "merge", String(prNumber), "--repo", repo, "--auto", "--squash", "--delete-branch"]);
}
