# PageLoom Autonomous Development Manager

This document describes the system that lets approved PageLoom backlog work continue
without Isaac manually triggering every task. It is intentionally built as a thin
GitHub-native layer on top of the automation that already exists in this repository
(`.github/workflows/claude.yml` and `.github/workflows/claude-code-review.yml`) rather than
a new execution engine — see [Architecture](#architecture).

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
   ├─ ensure-labels          creates the autonomous:* labels if missing
   ├─ dispatch-next-task     automation/select-next-task.mjs:
   │                           1. fetch open issues labeled autonomous:approved
   │                           2. classify() each against automation/policy.json
   │                           3. PROTECTED ones → comment once explaining why, label
   │                              autonomous:blocked, stop (never proceeds)
   │                           4. pick the highest-priority SAFE, not-in-progress issue
   │                           5. label it autonomous:in-progress (claims it)
   │                           6. post a "@claude implement this" comment on the issue
   │                           7. update the pinned status-board issue
   ├─ release-lock-on-completion   on PR-merged / issue-closed: swap
   │                                autonomous:in-progress → autonomous:done
   └─ auto-merge-check        automation/check-merge-eligibility.mjs, for every open
                              PR labeled autonomous:safe: enable GitHub-native
                              auto-merge only if every safety condition holds
              │
              ▼
 Step 6's comment contains "@claude", so the EXISTING .github/workflows/claude.yml
 fires exactly as it does for a human-authored comment: Claude Code checks out the
 branch, implements the change, runs validation, commits, pushes, and opens a PR.
              │
              ▼
 The EXISTING .github/workflows/claude-code-review.yml fires on that PR, exactly as
 it does today for any PR.
              │
              ▼
 automation/check-merge-eligibility.mjs later enables auto-merge if — and only if —
 the PR is labeled autonomous:safe, has no PROTECTED label, is not a draft, has no
 conflicts, every required check succeeded, and there is no unresolved/requested-changes
 review.
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
keyword/label fired; this is what gets posted back to the issue.

## What the manager can do autonomously

Exactly the list from the originating issue, and no more: read the repo and approved
backlog, prioritize SAFE tasks, and (via the existing `claude.yml`/`claude-code-review.yml`
pipeline it triggers) create branches, write/modify application code, fix bugs, refactor
low-risk code, add/improve tests, improve error handling and documentation, perform
code-level security hardening, run install/typecheck/lint/test/build, diagnose and fix
ordinary CI failures, commit, push agent branches, open PRs, and move to the next approved
SAFE task without Isaac re-triggering it.

## What is always blocked (PROTECTED)

Every category in [The SAFE / PROTECTED policy](#the-safe--protected-policy) above, with no
exceptions and no auto-merge, ever. A PROTECTED classification produces a comment on the
issue explaining the reason and stops there — it is a request for Isaac, never a queued
action.

## Trigger and schedule

- **Schedule:** every 30 minutes (`cron: "*/30 * * * *"` in the workflow template) it checks
  the backlog for the next SAFE task, and separately sweeps open `autonomous:safe` PRs for
  auto-merge eligibility.
- **Manual:** `workflow_dispatch` — Isaac can trigger an immediate check from the Actions
  tab.
- **Lifecycle cleanup:** fires on `issues: closed` and `pull_request: closed` to release the
  `autonomous:in-progress` claim.
- **Concurrency:** a single Actions `concurrency: group: autonomous-manager` ensures only
  one "pick the next task" run is ever in flight repo-wide; per-issue, the
  `autonomous:in-progress` label is the claim that prevents a second run from picking the
  same issue.

## Merge policy

A PR may have GitHub-native auto-merge (`gh pr merge --auto --squash`) enabled by
`automation/check-merge-eligibility.mjs` only when **all** of the following hold — the
check fails closed (defaults to *not eligible*) if any signal is missing or ambiguous:

- the PR is labeled `autonomous:safe`, and **not** labeled `autonomous:protected`
- the PR is not a draft
- `mergeable == MERGEABLE` (no conflicts)
- `mergeStateStatus == CLEAN` (branch protection / required-check gate is satisfied)
- `reviewDecision` is not `CHANGES_REQUESTED` or `REVIEW_REQUIRED`
- every reported status check succeeded (none failing, none still pending, and at least one
  check must have reported — an empty check list is treated as *not eligible*, not as "no
  checks needed")

`gh pr merge --auto` only *enables* GitHub's own auto-merge queue — it never bypasses
branch protection or required checks; if Isaac has required checks configured, GitHub
itself still enforces them at merge time. **PROTECTED work is never even considered** for
this path; the auto-merge sweep only ever looks at PRs labeled `autonomous:safe`.

## Status reporting

The manager maintains one pinned issue, labeled `autonomous:status-board` (created
automatically on first run), showing: the currently running task and its classification
and reason, the PR it produced (once one exists), last completed task, any approved-but-
PROTECTED issues waiting on Isaac, and the SAFE queue. In addition, every classification
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
5. That's it — no need to comment `@claude` yourself. The next scheduled run (≤30 minutes,
   or trigger it immediately via **Actions → Autonomous Development Manager → Run
   workflow**) will pick it up if it's the highest-priority SAFE, not-already-running item.
6. If it gets classified PROTECTED instead, the manager comments on the issue explaining
   why and stops. Isaac can either handle the protected part manually, or edit the issue /
   remove the offending detail and let the manager re-evaluate it next cycle.

## One-time setup required from Isaac

This is deliberate: the manager cannot configure any of this itself, by design (see
`automation/workflow-templates/README.md`).

1. Copy `automation/workflow-templates/autonomous-manager.yml` to
   `.github/workflows/autonomous-manager.yml` and push it (Claude Code's GitHub App cannot
   write to `.github/workflows/`).
2. Confirm the repository's default `GITHUB_TOKEN` has "Read and write permissions"
   (Settings → Actions → General → Workflow permissions) so it can label/comment/merge.
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
- **Auto-merge eligibility does not itself re-read the diff.** It trusts the PR's own
  `autonomous:safe` label (set by Claude when it opens the PR, per the instructions in the
  trigger comment) plus CI/review signals. If Claude mislabels a PR that actually touched
  something protected, the keyword scan on the *issue* text was the safeguard, not a second
  scan of the *diff* — a genuinely thorough guarantee would require re-classifying the
  actual file changes, which is out of scope for this first version.
- **The status board's "currently running" section is a snapshot from the dispatch run**,
  not a live subscription to the PR's CI/review state; refreshing it further would mean
  wiring the board update into `claude.yml`/`claude-code-review.yml`, which this change
  intentionally avoids touching.
- `automation/*.test.mjs` run via `npm run test:automation`, chained onto the root `npm
  test` script — so `.github/workflows/ci.yml` exercises them on every PR already, with no
  workflow-file change needed. Only the *scheduling* workflow
  (`autonomous-manager.yml`) needs the manual one-time copy described above.
