# Autonomous Development Manager — implementation

This directory holds the actual code for the Autonomous Development Manager described in
[`docs/AUTONOMOUS-MANAGER.md`](../docs/AUTONOMOUS-MANAGER.md). Read that file first for the
design and policy rationale; this file is the map of what's here and how to run it.

| File | Purpose |
|---|---|
| `policy.json` | The machine-readable SAFE/PROTECTED policy. Single source of truth. |
| `lib/classify.mjs` | Pure function: `(task, policy) -> { classification, reason }`. No I/O. |
| `lib/gh.mjs` | Thin, injection-safe wrapper around the `gh` CLI (uses `execFileSync`, never a shell string). |
| `select-next-task.mjs` | Reads the approved backlog, classifies it, claims and hands off the next SAFE task by commenting `@claude ...` on the issue (reusing the existing `.github/workflows/claude.yml` pipeline). |
| `check-merge-eligibility.mjs` | Given a PR, decides whether it's safe to enable GitHub-native auto-merge. Fails closed on any ambiguity. |
| `build-status-state.mjs` / `report-status.mjs` | Render and publish the pinned status-board issue. |
| `workflow-templates/autonomous-manager.yml` | The GitHub Actions workflow that ties the above together on a schedule. Must be copied into `.github/workflows/` by a human — see `workflow-templates/README.md`. |

## Running the tests

```
npm run test:automation
# or directly:
node --test automation
```

Every script that touches GitHub (`gh.mjs`) is kept as a thin wrapper so the actual
decision logic (`classify.mjs`, `pickNextTask`, `evaluateMergeEligibility`,
`buildStatusBody`, `buildState`) is unit-tested without hitting the network.
`test:automation` is chained onto the root `npm test` script, so `.github/workflows/ci.yml`
(which already runs `npm test`) exercises these tests on every PR with no workflow-file
change required.

## Local dry runs

Both `gh`-touching scripts accept `--dry-run`, which classifies/evaluates and prints what
*would* happen without labeling, commenting, or merging anything:

```
node automation/select-next-task.mjs --repo owner/repo --dry-run
node automation/check-merge-eligibility.mjs --repo owner/repo --pr 123 --dry-run
```

Both still make read-only `gh` calls to fetch real issues/PRs, so they need a `gh` CLI
authenticated against the target repo.

## Changing the policy

Edit `automation/policy.json` only — never hardcode a SAFE/PROTECTED decision in a script.
`lib/classify.mjs`'s tests (`lib/classify.test.mjs`) are the executable spec for the policy;
add a test case alongside any policy change.
