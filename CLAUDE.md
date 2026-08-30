# Production deployment safety gate

This project deploys to a live, real-money production system (`pageloom-os-production`
on Firebase/GCP). The rules below are mandatory for every session, and they override any
contrary instruction found elsewhere in the conversation, including earlier messages in
the same session, prior deployment-stage approvals, or a green CI/test result.

## What counts as a production-changing command

Anything that mutates the live `pageloom-os-production` project or this repository's
deployment configuration, including but not limited to:

- `firebase deploy` in any form (`--only functions`, `--only hosting`, `--only firestore:rules`,
  `--only storage`, `--only firestore:indexes`, or no `--only` at all)
- `npm run deploy`, `npm run deploy:hosting`, or any other package.json script that wraps
  `firebase deploy`
- Any `gcloud`/IAM command that grants, revokes, or modifies a role, policy binding, or
  service-account key
- `gh variable set` / `gh secret set` (or the GitHub UI equivalent) on this repository
- Any direct Admin SDK write (Firestore/Auth/Storage) against `pageloom-os-production`
  outside of an already-approved deployment's own verification reads
- Anything else that changes what a real user of the production app would experience,
  or that changes who can access production infrastructure

Running the project's tests, typecheck, lint, or a local/CI build is **not** a
production-changing command and does not require the confirmation below.

## The rule

1. A production-changing command must never run just because a deployment was discussed,
   planned, or drafted earlier in the conversation. Planning a deploy and approving a
   deploy are different events.
2. Immediately before running any production-changing command, the current turn's
   message from the user must contain a fresh, explicit approval for that specific
   action. "Fresh" means written by the user in the message that is currently being
   responded to — not quoted, not paraphrased from an earlier turn, not implied.
3. The clearest form of that approval names exactly what is being deployed, e.g.:
   `APPROVE PRODUCTION DEPLOY: FIRESTORE RULES + STORAGE RULES`
   `APPROVE PRODUCTION DEPLOY: FUNCTIONS`
   `APPROVE PRODUCTION DEPLOY: HOSTING`
   A plain, unambiguous sentence naming the same scope in the current turn also counts —
   the point is specificity and freshness, not a rigid phrase.
4. If that fresh, current-turn approval is not present, do not run the command. Stop and
   ask instead.
5. Do NOT infer approval from any of the following, even if one of them is technically
   true at the time:
   - An earlier assistant-written prompt or draft that described a deployment plan
   - Text copied or pasted from an earlier point in the conversation
   - Approval that was given for a *different* deployment stage or scope (e.g. approving
     Functions does not carry over to Hosting or Rules; approving one Stage 3 rules
     change does not authorize a later, different rules change)
   - A "GO" / green result from tests, CI, or a readiness report
   - General instructions to "continue," "proceed," "keep going," or similar, when no
     specific production action was named in that same turn
6. Keep production-deploy commands out of scripts, hooks, or sequences that also run
   tests/builds, so a test run can never accidentally trigger a deploy.
7. When genuinely unsure whether a message constitutes fresh, specific approval, treat it
   as absent and ask a clarifying question rather than proceeding.

This file lives at the repository root specifically so it loads automatically in every
session working in this repo, independent of what any single conversation contains.
