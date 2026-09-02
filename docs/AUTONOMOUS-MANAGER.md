# PageLoom Autonomous Development Manager

This document describes the system that lets approved PageLoom backlog work continue
without Isaac manually triggering every task. It is intentionally built as a thin
GitHub-native layer on top of the automation that already exists in this repository
(`.github/workflows/claude.yml` and `.github/workflows/claude-code-review.yml`) rather than
a new execution engine — see [Architecture](#architecture).

The manager coordinates a small team of explicit agent **roles** — see
[Agent roles](#agent-roles) — with independent review, a shared status board, and bounded
concurrency, while the Autonomous Manager itself remains the single coordinator above all
of them. There is no self-merge, no auto-merge, and no path around human final authority
for merges or PROTECTED work — see [Merge policy](#merge-policy).

**This system never overrides [`CLAUDE.md`](../CLAUDE.md).** The production deployment
safety gate in `CLAUDE.md` still applies to every action taken under this manager, with or
without a fresh human approval in the conversation, because there is no conversation here
at all — only pre-approved, policy-checked backlog items.

## Architecture

```
 Isaac labels an issue "autonomous:approved"
              │
              ▼
 automation/workflow-templates/autonomous-manager.yml   (scheduled, every 30 min)
   ├─ ensure-labels                    creates the autonomous:* labels if missing
   ├─ check-worker-health-and-readiness   automation/check-merge-eligibility.mjs, for
   │                                      every open PR labeled autonomous:safe:
   │                                        - readiness: CI green + review clean + QA
   │                                          passed → label autonomous:ready-for-merge
   │                                          (never merges — see Merge policy)
   │                                        - health: failing checks → label the linked
   │                                          issue autonomous:blocked (fail-closed)
   ├─ dispatch-qa-review               automation/dispatch-qa-review.mjs: any open
   │                                   worker PR without a QA review yet gets a fresh,
   │                                   independent "@claude review this" comment
   ├─ dispatch-next-task               automation/select-next-task.mjs:
   │                                     1. fetch open issues labeled autonomous:approved
   │                                     2. classify() each against automation/policy.json
   │                                        (unchanged — see SAFE/PROTECTED policy below)
   │                                     3. PROTECTED ones → comment once explaining why,
   │                                        label autonomous:blocked, stop (never proceeds)
   │                                     4. if any in-progress worker is already blocked,
   │                                        dispatch capacity is 0 this run (fail-closed)
   │                                     5. otherwise pick up to (maxConcurrentWorkers -
   │                                        active workers) highest-priority SAFE,
   │                                        not-in-progress issues
   │                                     6. determineRole() assigns each to the Developer
   │                                        or Business & Operations role
   │                                     7. label each autonomous:in-progress + its role
   │                                        label (claims it), post a role-specific
   │                                        "@claude implement this" comment
   │                                     8. update the pinned status-board issue
   └─ release-lock-on-completion       on PR-merged / issue-closed: swap
                                       autonomous:in-progress → autonomous:done
              │
              ▼
 Step 7's comment contains "@claude", so the EXISTING .github/workflows/claude.yml
 fires exactly as it does for a human-authored comment: Claude Code checks out the
 branch, implements the change (as the assigned role), runs validation, commits,
 pushes, and opens a PR.
              │
              ▼
 The EXISTING .github/workflows/claude-code-review.yml fires on that PR, exactly as
 it does today for any PR. dispatch-qa-review's comment additionally asks a *separate*,
 independent Claude Code session to act as the QA & Safety Agent and record its verdict
 as a label — never the same session that implemented the change.
              │
              ▼
 check-merge-eligibility.mjs labels the PR autonomous:ready-for-merge once — and only
 once — the PR is labeled autonomous:safe, has no PROTECTED label, is not a draft, has
 no conflicts, every required check succeeded, review is clean, AND the independent
 QA/Safety review passed. Isaac merges it by hand; nothing in this repository ever runs
 `gh pr merge`.
```

No new "orchestrator" process, database, or bot identity is introduced. The only new
runtime component is one more scheduled GitHub Actions workflow plus a handful of small
Node scripts (`automation/*.mjs`) with no dependencies beyond the `gh` CLI that's
preinstalled on GitHub-hosted runners.

## The SAFE / PROTECTED policy

The full, machine-readable policy lives in [`automation/policy.json`](../automation/policy.json)
and is enforced by [`automation/lib/classify.mjs`](../automation/lib/classify.mjs) (unit
tests: `automation/lib/classify.test.mjs`). In order, a task is classified:

1. **PROTECTED**, always, if it (or its issue) carries the `autonomous:protected` label.
2. **PROTECTED**, always, if its title/body contains any keyword from one of the six hard
   boundary categories below — this check **cannot be overridden** by any label, including
   `autonomous:approved` or `autonomous:safe`. This is deliberate defense-in-depth: a
   mislabeled issue must never be able to authorize protected work.
   - `money` — payments, charges, refunds, invoices, subscriptions, billing, credits, paid
     API activation, spending limits.
   - `firebase-cloud-production` — Firebase/GCP production config, IAM, service accounts,
     App Check, production Firestore/Storage, Functions/Hosting deploys.
   - `secrets` — API keys, passwords, tokens, private keys, certificates, credential
     rotation.
   - `production-infrastructure` — domains, DNS, SSL, production hosting/cloud infra.
   - `customers-and-customer-data` — real customer data/accounts, customer communications,
     contracts, legal acceptance.
   - `destructive-or-high-risk` — destructive DB/storage operations, risky migrations,
     deletion of production resources, anything irreversible.
3. **PROTECTED** if the issue is not labeled `autonomous:approved` — unapproved backlog
   items are never touched.
4. **SAFE** if the issue matches a recognized safe category (bug fix, low-risk refactor,
   tests, error handling, documentation, code-level security hardening, ordinary CI fix) or
   carries an explicit `autonomous:safe` label from a human reviewer.
5. **PROTECTED** otherwise — **unknown work defaults to PROTECTED**, per the issue's own
   requirement.

Every classification decision comes with a `reason` string naming exactly which rule and
keyword/label fired; this is what gets posted back to the issue. **None of this changed** —
the multi-agent work below only adds role-routing and gating on top of an already-SAFE
task; it never alters how SAFE vs. PROTECTED is decided.

## Agent roles

Every SAFE task is assigned to exactly one explicit role by
[`automation/lib/route.mjs`](../automation/lib/route.mjs)'s `determineRole()`, which never
runs on PROTECTED work. The Autonomous Manager (the scheduled workflow itself) remains the
single coordinator above all of them — it decides what gets dispatched, to whom, and when;
no role ever dispatches work to another role or to itself.

- **Developer Agent** (`autonomous:role-developer`) — implementation, bug fixes, refactors,
  tests, UI/code work. The default role for SAFE, code-shaped categories (bug fix, refactor,
  tests, error handling, documentation, code-level security hardening, CI fix).
- **QA & Safety Agent** (`autonomous:role-qa-safety`) — never picked from the backlog.
  Instead, [`automation/dispatch-qa-review.mjs`](../automation/dispatch-qa-review.mjs) posts
  a fresh, independent `@claude` review request on every open worker PR that doesn't have
  one yet, asking it to check scope (does the diff match the linked issue and nothing more?),
  tests, regressions, tenant isolation, and this repo's safety requirements, then record its
  verdict as `autonomous:qa-passed` or `autonomous:qa-changes-requested`. **A worker never
  approves its own work**: the Developer/Business & Operations trigger comment never grants
  permission to add a QA label — only this separate, independently-triggered request does.
- **Business & Operations Agent** (`autonomous:role-business-ops`) — repository-based
  business-process documentation, proposals/templates, onboarding/process assets, and
  operational task preparation. Routed via `automation/policy.json`'s
  `businessOpsCategories` keyword list (or an explicit `autonomous:role-business-ops` label),
  giving it a separate queue/role from code work. Its trigger comment explicitly forbids
  claiming to have contacted anyone or completed any external action — this role has no real
  external integration, and is instructed to stop and ask for PROTECTED handling if a task
  actually requires one.

A human can always override the keyword-based guess by adding the matching
`autonomous:role-*` label to the issue before the manager picks it up.

## What the manager can do autonomously

Exactly the list from the originating issue, and no more: read the repo and approved
backlog, prioritize SAFE tasks, assign each to an explicit role, and (via the existing
`claude.yml`/`claude-code-review.yml` pipeline it triggers) create branches, write/modify
application code or repository-based business-process documents, fix bugs, refactor
low-risk code, add/improve tests, improve error handling and documentation, perform
code-level security hardening, run install/typecheck/lint/test/build, diagnose and fix
ordinary CI failures, commit, push agent branches, open PRs, independently QA/Safety-review
another worker's PR, and move to the next approved SAFE task without Isaac re-triggering it
— up to `policy.maxConcurrentWorkers` (currently **2**) worker tasks in flight at once.

## What is always blocked (PROTECTED)

Every category in [The SAFE / PROTECTED policy](#the-safe--protected-policy) above, with no
exceptions and no auto-merge, ever. A PROTECTED classification produces a comment on the
issue explaining the reason and stops there — it is a request for Isaac, never a queued
action.

## Concurrency and duplicate-work prevention

- **Max concurrency:** `automation/policy.json`'s `maxConcurrentWorkers` (currently 2) caps
  how many issues may be labeled `autonomous:in-progress` at once. `select-next-task.mjs`
  recomputes the current in-progress count from live GitHub state on every run — the cap
  holds across runs, not just within one — and only dispatches up to the remaining capacity.
  QA reviews don't count against this cap: reviewing an existing PR isn't a new worker task.
- **One task = one branch = one PR:** unchanged from the original design. An issue is
  claimed by adding `autonomous:in-progress` before any work starts, so a second run can
  never dispatch a second agent onto the same issue.
- **Fail-closed on repeated check failures:** if any in-progress issue is also labeled
  `autonomous:blocked` (set by `check-merge-eligibility.mjs` when its PR's CI keeps
  failing), dispatch capacity drops to **zero** for that run — no new work starts while an
  existing worker is stuck. The label clears automatically once checks turn green, and the
  stuck worker's own issue/PR is left untouched (a human decides what to do with it).
- **Known limitation:** the in-progress label is a claim, not a true distributed lock (see
  [Remaining risks](#remaining-risks--limitations)), and file-level overlap between two
  *different* issues is not detected — well-scoped, non-overlapping backlog items remain
  Isaac's responsibility when writing the issue.

## Trigger and schedule

- **Schedule:** every 30 minutes (`cron: "*/30 * * * *"` in the workflow template) it checks
  worker-PR health/readiness, requests QA reviews, and dispatches up to the remaining
  concurrency capacity from the SAFE backlog.
- **Manual:** `workflow_dispatch` — Isaac can trigger an immediate check from the Actions
  tab.
- **Lifecycle cleanup:** fires on `issues: closed` and `pull_request: closed` to release the
  `autonomous:in-progress` (and any stale `autonomous:blocked`) claim.
- **Concurrency (Actions-level):** a single Actions `concurrency: group: autonomous-manager`
  ensures only one "pick the next task" run is ever in flight repo-wide; per-issue, the
  `autonomous:in-progress` label is the claim that prevents a second run from picking the
  same issue, and `maxConcurrentWorkers` is the separate cap on how many issues may hold
  that claim at once.

## Merge policy

**There is no automatic merge path.** No script in `automation/` and no job in
`automation/workflow-templates/autonomous-manager.yml` ever runs `gh pr merge`, in any
form, for any reason — this was true before this change (the previously-installed workflow
already omitted the auto-merge job) and is now also enforced by the code itself:
`automation/lib/gh.mjs` has no function that merges a PR.

Instead, `automation/check-merge-eligibility.mjs` labels a PR `autonomous:ready-for-merge`
— purely informational, a signal for Isaac — only when **all** of the following hold; it
fails closed (defaults to *not ready*) if any signal is missing or ambiguous:

- the PR is labeled `autonomous:safe`, and **not** labeled `autonomous:protected`
- the PR is not a draft
- `mergeable == MERGEABLE` (no conflicts)
- `mergeStateStatus == CLEAN` (branch protection / required-check gate is satisfied)
- `reviewDecision` is not `CHANGES_REQUESTED` or `REVIEW_REQUIRED`
- every reported status check succeeded (none failing, none still pending, and at least one
  check must have reported — an empty check list is treated as *not ready*, not as "no
  checks needed")
- **the independent QA & Safety review passed** (`autonomous:qa-passed` is present and
  `autonomous:qa-changes-requested` is not) — new in this change; this is what makes
  "Developer output cannot be marked ready until independent QA/Safety review passes" hold

**PROTECTED work is never even considered** for this path; the check only ever looks at PRs
labeled `autonomous:safe`. Merging — for every PR, SAFE or otherwise — remains Isaac's
explicit, manual action, exactly as acceptance criterion 6 of the originating issue
requires.

## Status reporting

The manager maintains one pinned issue, labeled `autonomous:status-board` (created
automatically on first run), showing: current concurrency (`active / max`), every active
worker's issue, role, PR (once one exists), live CI/review/QA state, and a computed "next
action" line; any approved-but-PROTECTED issues waiting on Isaac; the SAFE queue (with each
item's assigned role); the last completed task; and, if new dispatch is currently paused by
the fail-closed check, an explicit warning saying so. In addition, every classification
decision is posted as a comment directly on the relevant issue, so the reasoning is visible
at the point of decision, not just on a dashboard.

## Backlog format — how Isaac gives the manager work

1. File or identify a normal GitHub issue describing one meaningful, well-scoped task.
2. Add the label **`autonomous:approved`**.
3. Optionally add a priority label (`priority:p0` highest … `priority:p3` lowest); unlabeled
   issues are treated as lowest priority and processed oldest-first.
4. Optionally add **`autonomous:safe`** to explicitly mark it safe even if it doesn't match
   one of the built-in safe-category keywords (a hard PROTECTED keyword still overrides
   this, per the defense-in-depth rule above).
5. Optionally add **`autonomous:role-developer`** or **`autonomous:role-business-ops`** to
   override the automatic role guess (see [Agent roles](#agent-roles)).
6. That's it — no need to comment `@claude` yourself. The next scheduled run (≤30 minutes,
   or trigger it immediately via **Actions → Autonomous Development Manager → Run
   workflow**) will pick it up if it's the highest-priority SAFE, not-already-running item.
7. If it gets classified PROTECTED instead, the manager comments on the issue explaining
   why and stops. Isaac can either handle the protected part manually, or edit the issue /
   remove the offending detail and let the manager re-evaluate it next cycle.

## One-time setup required from Isaac

This is deliberate: the manager cannot configure any of this itself, by design (see
`automation/workflow-templates/README.md`).

1. Copy `automation/workflow-templates/autonomous-manager.yml` to
   `.github/workflows/autonomous-manager.yml` and push it (Claude Code's GitHub App cannot
   write to `.github/workflows/`). **If this file already exists** from before this change,
   it needs to be re-copied to pick up the QA-gating, role-routing, and worker-health jobs.
2. Confirm the repository's default `GITHUB_TOKEN` has "Read and write permissions"
   (Settings → Actions → General → Workflow permissions) so it can label issues/PRs and
   comment. No job merges anything, so no merge-related permission is needed.
3. Confirm branch protection on `main` requires the checks Isaac wants enforced before
   merge (this system reads that state, it never weakens or configures it).
4. Start labeling approved backlog issues `autonomous:approved`.

Nothing else — no new secrets, no new bot account, no third-party service.

## Remaining risks / limitations

- **Label-claim race:** the per-issue `autonomous:in-progress` label is not a true
  distributed lock. The workflow-level `concurrency: group: autonomous-manager` makes a
  same-workflow race very unlikely, but a human manually commenting `@claude` on the same
  issue at the same moment as a scheduled run is not fully guarded against.
- **Keyword-based classification is a heuristic, not a guarantee.** It is deliberately
  conservative (defaults to PROTECTED, hard keywords cannot be overridden), but a cleverly
  or accidentally worded SAFE issue that omits every listed keyword while still describing
  protected work would be misclassified. Isaac reviewing what gets labeled
  `autonomous:approved` in the first place remains the primary safeguard — this policy is a
  second layer, not the only one.
- **Readiness-for-merge does not itself re-read the diff.** It trusts the PR's own
  `autonomous:safe` label (set by Claude when it opens the PR, per the instructions in the
  trigger comment) plus CI/review/QA signals. If Claude mislabels a PR that actually touched
  something protected, the keyword scan on the *issue* text was the safeguard, not a second
  scan of the *diff* — a genuinely thorough guarantee would require re-classifying the
  actual file changes, which is out of scope for this version. The independent QA & Safety
  review is a second, largely-independent line of defense against exactly this, but it is
  still a Claude Code session following instructions, not a hard technical control.
- **"A worker never approves its own work" is enforced by process, not by identity.**
  Every role runs as the same `claude[bot]` GitHub identity (via the same
  `claude-code-action`), so there is no separate account to check. The guarantee instead
  comes from: the Developer/Business & Operations trigger comment never instructing that
  session to add a QA label; the QA review always being requested in a fresh, separate
  session by `dispatch-qa-review.mjs`, with only the diff (not the implementation
  conversation) as context; and `CLAUDE.md`'s repo-wide production-safety instructions
  applying to every session regardless of role.
- **The status board's live enrichment is bounded, not exhaustive.** `report-status.mjs`
  fetches live PR/CI/QA state for every currently in-progress issue (bounded by
  `maxConcurrentWorkers`), but the SAFE/PROTECTED queue sections still reflect the most
  recent dispatch run rather than being fully re-derived on every status refresh.
- `automation/*.test.mjs` run via `npm run test:automation`, chained onto the root `npm
  test` script — so `.github/workflows/ci.yml` exercises them on every PR already, with no
  workflow-file change needed. Only the *scheduling* workflow
  (`autonomous-manager.yml`) needs the manual one-time copy described above.
