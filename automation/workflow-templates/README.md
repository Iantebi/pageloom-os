# Installing the Autonomous Manager workflow

`autonomous-manager.yml` in this directory is a ready-to-use GitHub Actions workflow. It
is **not** active yet in this updated form, because Claude Code's GitHub App cannot write to
`.github/workflows/` — that restriction is intentional (an automated agent should never be
able to grant itself more CI/CD power), so this one file needs a human to install it.

**If `.github/workflows/autonomous-manager.yml` already exists** (an earlier, single-role
version of this workflow), it needs to be **re-copied** from this template to pick up the
Developer / QA & Safety / Business & Operations roles, the max-2-concurrent-workers cap,
independent QA gating, and the worker-health fail-closed check added by this change. The
new jobs are additive (new labels, new scripts) — nothing here weakens the existing
SAFE/PROTECTED policy or introduces a merge path.

## One-time setup (Isaac)

1. Copy the file:
   ```
   cp automation/workflow-templates/autonomous-manager.yml .github/workflows/autonomous-manager.yml
   ```
2. Commit and push it directly to `main` (or via a small PR you merge yourself) — this is a
   repository configuration change, not application code, and is the kind of action the
   autonomous manager itself is not permitted to take.
3. No new secrets are required. The workflow only uses the default `secrets.GITHUB_TOKEN`.
4. Confirm the token has these repository permissions (Settings → Actions → General →
   Workflow permissions): **Read and write permissions**, so `GITHUB_TOKEN` can label
   issues/PRs and comment. This is the same least-privilege token GitHub already scopes to
   this one repository and this one workflow run. No job in this workflow ever merges a
   PR — merging remains Isaac's manual action.
5. Nothing else to configure — the workflow's own `ensure-labels` job creates the
   `autonomous:*` labels it needs the first time it runs.

## How to give the manager work

Label an approved issue `autonomous:approved` (see `docs/AUTONOMOUS-MANAGER.md`). That's
the entire interface — the workflow polls every 30 minutes (and can be run on demand via
**Actions → Autonomous Development Manager → Run workflow**).

## Turning it off

Delete or disable `.github/workflows/autonomous-manager.yml` (Actions tab → the workflow →
"..." → Disable workflow). The rest of the automation (`automation/*.mjs`,
`automation/policy.json`) is inert without it — nothing else in the repository invokes
these scripts automatically.
