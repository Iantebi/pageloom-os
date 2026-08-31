# Installing the Autonomous Manager workflow

`autonomous-manager.yml` in this directory is a ready-to-use GitHub Actions workflow. It
is **not** active yet, because Claude Code's GitHub App cannot write to
`.github/workflows/` — that restriction is intentional (an automated agent should never be
able to grant itself more CI/CD power), so this one file needs a human to install it.

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
   issues, comment, open/merge PRs. This is the same least-privilege token GitHub already
   scopes to this one repository and this one workflow run.
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
