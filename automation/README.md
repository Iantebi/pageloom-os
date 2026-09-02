# Autonomous Development Manager — implementation

This directory holds the actual code for the Autonomous Development Manager described in
[`docs/AUTONOMOUS-MANAGER.md`](../docs/AUTONOMOUS-MANAGER.md). Read that file first for the
design and policy rationale; this file is the map of what's here and how to run it.

| File | Purpose |
|---|---|
| `policy.json` | The machine-readable SAFE/PROTECTED policy, worker roles, business/operations keyword categories, and the max-concurrency limit. Single source of truth. |
| `lib/classify.mjs` | Pure function: `(task, policy) -> { classification, reason }`. No I/O. Unchanged by the multi-agent work — SAFE/PROTECTED classification stays authoritative and untouched. |
| `lib/route.mjs` | Pure function: `(task, decision, policy) -> "developer" \| "business-ops" \| null`. Assigns a worker role to an already-SAFE task; never touches classification. |
| `lib/gh.mjs` | Thin, injection-safe wrapper around the `gh` CLI (uses `execFileSync`, never a shell string). Has no function that merges a PR — there is no auto-merge path anywhere in this directory. |
| `select-next-task.mjs` | Reads the approved backlog, classifies it, assigns a role, and claims + hands off up to `policy.maxConcurrentWorkers` SAFE tasks per run by commenting `@claude ...` on each issue (reusing the existing `.github/workflows/claude.yml` pipeline). Fails closed: if any in-progress worker is labeled blocked, dispatch capacity drops to zero. |
| `dispatch-qa-review.mjs` | Requests an independent QA & Safety Agent review (a fresh `@claude` comment) on every open worker PR that doesn't have one yet. This is what makes "a worker never approves its own work" hold in practice. |
| `check-merge-eligibility.mjs` | Given a PR, decides whether it's ready for **Isaac to merge by hand** — now gated on an independent QA-passed label in addition to CI/review/conflict state. Fails closed on any ambiguity, and never calls `gh pr merge`. Also detects repeated CI failures on worker PRs and labels the linked issue blocked (read by `select-next-task.mjs` to pause new dispatch). |
| `build-status-state.mjs` / `report-status.mjs` | Render and publish the pinned status-board issue: concurrency, every active worker's role/PR/CI/review/QA state and next action, the PROTECTED queue, and the SAFE queue by role. |
| `workflow-templates/autonomous-manager.yml` | The GitHub Actions workflow that ties the above together on a schedule. Must be copied into `.github/workflows/` by a human — see `workflow-templates/README.md`. |

## Running the tests

```
npm run test:automation
# or directly:
node --test automation/*.test.mjs automation/lib/*.test.mjs
```

Every script that touches GitHub (`gh.mjs`) is kept as a thin wrapper so the actual
decision logic (`classify.mjs`, `pickNextTask`, `evaluateMergeEligibility`,
`buildStatusBody`, `buildState`) is unit-tested without hitting the network.
`test:automation` is chained onto the root `npm test` script, so `.github/workflows/ci.yml`
(which already runs `npm test`) exercises these tests on every PR with no workflow-file
change required.

## Local dry runs

Every `gh`-touching script accepts `--dry-run`, which classifies/evaluates and prints what
*would* happen without labeling or commenting on anything (and, as always, without ever
merging anything):

```
node automation/select-next-task.mjs --repo owner/repo --dry-run
node automation/dispatch-qa-review.mjs --repo owner/repo --dry-run
node automation/check-merge-eligibility.mjs --repo owner/repo --pr 123 --dry-run
```

Both still make read-only `gh` calls to fetch real issues/PRs, so they need a `gh` CLI
authenticated against the target repo.

## Changing the policy

Edit `automation/policy.json` only — never hardcode a SAFE/PROTECTED decision in a script.
`lib/classify.mjs`'s tests (`lib/classify.test.mjs`) are the executable spec for the policy;
add a test case alongside any policy change.
