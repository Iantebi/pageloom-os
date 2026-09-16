# PageLoom engineering organization — multi-agent development team blueprint

> **Status: proposal / documentation only.** Nothing in this document is wired up yet.
> No application code, `.github/workflows/*`, `automation/policy.json`, or deployment
> configuration has been changed to implement it. It exists so the design can be
> reviewed, revised, and approved before any of the phased changes in §8 are made.
>
> **Maintenance policy.** This is the long-term blueprint for how PageLoom's own
> codebase gets developed and operated by a team of specialized agents. Once any phase
> in §8 ships, update the matching section here in the same PR — this document should
> never describe a system that no longer matches `automation/policy.json`,
> `automation/lib/route.mjs`, or the active GitHub label set. Cross-referenced from
> `docs/ARCHITECTURE.md`.
>
> **Authored:** 2026-09-16, as a proposal against `main` @ `dff6221`, following a full
> read-only architecture pass (see `docs/ARCHITECTURE.md`).
>
> **Revised same day** after a completeness review found several source files with no
> assigned owner (including `functions/src/workflow-engine.ts`, `tool-gateway.ts`, most
> of `orchestrator.ts`, and the backup/watchdog/queue-recovery functions), an
> unbacked ownership claim over the staff/customer dashboard, and an entire
> analytics/reporting/fleet-health cluster with no home. §4.2, §4.4, §4.5, §4.6, §4.8,
> §4.9, and §4.11 were corrected; §4.12 (a recommended 12th role) and new workflow
> coverage in §5–§7 were added. See §9 for the resulting open questions.

---

## 1. Purpose

PageLoom's own codebase is developed partly by autonomous Claude Code agents today,
through the Autonomous Development Manager in `automation/`. That system currently
recognizes exactly **three** roles — Developer, QA & Safety, Business & Ops — routed by
keyword classification in `automation/lib/classify.mjs` and `route.mjs`.

This document proposes widening that to **eleven specialized roles**, each mapped onto
a real ownership boundary already visible in the codebase (Firebase config, CRM logic,
the content pipeline, security-sensitive paths, and so on). The goal is a development
organization that mirrors the *shape* of the system it maintains, the same way a human
engineering org would split into a security team, a platform team, a data team.

Nothing about the safety model changes. This document adds specialization **above**
the existing safety floor — `CLAUDE.md`'s production-deploy approval gate and
`automation/policy.json`'s PROTECTED classification remain untouched and authoritative,
exactly as they are today.

---

## 2. Two agent systems — do not conflate them

PageLoom already runs two separate agent systems. This blueprint is about the second
one. Keeping the distinction explicit is important enough to restate here even though
`docs/ARCHITECTURE.md` §5 also covers the product fleet.

| | **Product fleet** (already exists) | **Dev team** (this blueprint) |
|---|---|---|
| Serves | PageLoom's *customers* — builds their websites | PageLoom's *own codebase* |
| Defined in | `packages/core/src/agents/definitions.ts` | `automation/policy.json` + this document |
| Roster size | 22 (CEO, Sales, Firebase, QA, CRM, Content, …) | 11 required, +1 recommended (§4.12) |
| Executes via | The Central Orchestrator / manual AI queue, per customer project | Claude Code sessions dispatched over GitHub issues/PRs |
| Governed by | `tool-policy.ts`, `workflow.ts` approval gates | `automation/policy.json` SAFE/PROTECTED classification, `CLAUDE.md` |
| Human authority | The Owner, as CEO, per `workflows/customer-journey.v1.json` | Isaac, as repository owner |

The overlap in naming (Firebase, CRM, QA, Content, Security-adjacent, Sales) is
deliberate, not accidental: PageLoom's domain (running a web agency) and PageLoom's own
architecture (Firebase, CRM data model, content pipeline) are the same shape, so the
dev team that maintains the product naturally specializes along the same lines the
product itself does.

---

## 3. Design principles

1. **Reuse the existing substrate.** GitHub issues, labels, and `@claude` trigger
   comments already carry the current 3-role system. The 11-role system rides the same
   rails — `select-next-task.mjs`, `claude.yml`, the status-board issue — rather than
   introducing new infrastructure.
2. **The safety floor is not renegotiable.** `automation/policy.json`'s six hard
   PROTECTED keyword categories (money, firebase-cloud-production, secrets,
   production-infrastructure, customer data, destructive) apply identically to every
   role below. No role gets a standing exemption. `CLAUDE.md`'s fresh-approval-per-turn
   rule governs literal deploy commands regardless of which agent's session issues
   them.
3. **No agent merges its own work, and no agent merges at all.** Independent QA review
   stays mandatory for every role. `gh pr merge` is never called by any script in the
   toolchain, at any tier — a human merges, always.
4. **Specialization resolves ownership, not authority.** An agent's file-ownership list
   tells the dispatcher *who drafts and self-reviews* SAFE work in that area. It does
   not grant that agent standing to approve PROTECTED work in that area — that
   authority stays exactly where `CLAUDE.md` and `automation/policy.json` already put
   it: with Isaac.
5. **Ownership boundaries come from the codebase, not from this document.** Every path
   listed in §4 is a real directory or module that exists today; if the codebase's
   structure changes, this document's ownership table must change with it (see the
   maintenance policy banner above).

---

## 4. The eleven agents, plus one recommended addition

Each profile uses the same template: mandate, ownership, inputs/outputs, decision
rights, hard constraints, and escalation triggers — i.e., the point at which the agent
must stop and hand off rather than proceed.

### 4.1 CEO / Manager Agent

- **Mandate.** Classify incoming approved work, assign it to the correct specialist
  role, track concurrency, resolve cross-agent conflicts, keep the status board honest.
- **Owns.** `automation/policy.json` (interpretation, not authorship of policy changes
  — see §4.6), `automation/select-next-task.mjs`, the pinned status-board issue.
- **Inputs.** Issues labeled `autonomous:approved`.
- **Outputs.** Role-label assignment, `autonomous:in-progress` claim, a role-specific
  `@claude` trigger comment, status-board updates.
- **Decision rights.** May classify SAFE-vs-PROTECTED (deterministically, via the
  existing policy tree) and may pick which specialist claims a SAFE issue. May not
  originate PROTECTED-category work or approve it.
- **Hard constraints.** Writes no application code. Cannot approve PROTECTED work.
  Cannot merge PRs. Cannot change `automation/policy.json`'s classification rules
  itself — a policy change is, definitionally, a change to how safety is decided, and
  routes to Isaac like any other PROTECTED change.
- **Escalation.** Any issue that fails SAFE classification, or where two specialists'
  ownership overlaps and neither yields, escalates to the PROTECTED queue for Isaac.

### 4.2 Architecture Agent

- **Mandate.** Guard the shared contracts and state machines that every other layer
  depends on.
- **Owns.** `packages/core/src/{workflow.ts, types.ts, agents/}`,
  `functions/src/workflow-engine.ts` (the transactional runtime that actually executes
  the state machine `workflow.ts` defines), the non-model-routing parts of
  `functions/src/orchestrator.ts` — `delegate()`, `persistArtifacts()`,
  `persistDeploymentRecord()`, `persistQuestionnaire()`, `processActions()`,
  `checkAgentGovernance()` — `docs/ARCHITECTURE.md`, ADR-equivalent design notes.
  *(The AI Agent, §4.9, owns only `orchestrator.run()`'s model-selection/execution
  slice — see that profile for the exact split.)*
- **Inputs.** Any PR touching `WorkflowStage`/`JourneyStage`, the `AgentOutput`/`Task`
  contracts, the app↔functions↔core boundary, or the orchestrator's task-lifecycle
  logic listed above.
- **Outputs.** Sign-off (or requested changes) on contract-touching PRs; keeps
  `docs/ARCHITECTURE.md` current per its own maintenance banner.
- **Decision rights.** Required reviewer — not optional — on any PR touching its owned
  paths, regardless of which agent authored it.
- **Hard constraints.** Cannot unilaterally approve a change that alters an
  already-documented invariant (e.g., the two-stage-vocabulary split, or
  `eventAuthorizesProtectedStage()`'s gating role) without flagging it explicitly in
  the PR description as an architectural change, not a routine one.
- **Standing responsibility.** Holds `docs/ARCHITECTURE.md` §13 ("Cross-cutting notes")
  as a living checklist — reviews new PRs for the same class of drift already catalogued
  there (e.g., a new duplicated constant, a new undocumented bypass) and either fixes it
  or adds it to that list rather than letting it go unrecorded a second time.
- **Escalation.** Any change that would collapse the `JourneyStage`/`WorkflowStage`
  split, or alter what counts as a "protected stage," escalates to Isaac even if
  otherwise SAFE-classified — these are foundational decisions, not routine
  refactors.

### 4.3 Firebase Agent

- **Mandate.** Own Firestore/Storage Security Rules, indexes, Firebase project
  configuration, and the staged MFA/App Check rollout.
- **Owns.** `firestore.rules`, `storage.rules`, `firebase.json`,
  `firestore.indexes.json`, `functions/src/{firebase.ts, auth.ts, app-check.ts}`,
  `docs/mfa-app-check/`.
- **Inputs.** Rules/index/config changes; MFA rollout-stage progression requests.
- **Outputs.** Rule diffs with matching behavioral test coverage
  (`firestore-rules.behavioral.test.ts` / `storage-rules.behavioral.test.ts`).
- **Decision rights.** May author and self-review rule changes that *narrow* access.
- **Hard constraints.** Any rule change that *widens* read/write access, or any change
  to the deny-by-default catch-all, is automatically PROTECTED regardless of label —
  this mirrors the product's own Firebase Agent definition ("never weaken rules to ship
  a feature") applied to the codebase itself. Cannot flip `MFA_ENFORCEMENT_MODE` or the
  App Check enforcement toggle — those are Console/env actions reserved for Isaac per
  `docs/mfa-app-check/ROLLOUT.md`.
- **Escalation.** Any rule diff that removes a `staff()`/`privileged()`/`client()`
  guard, or that touches the `systemAdministrators` catch-all, escalates immediately.

### 4.4 CRM Agent

- **Mandate.** Own the lead/customer/project data model and the intake pipelines built
  on it.
- **Owns.** `functions/src/{closing-api.ts, customer-admin-api.ts, discovery-api.ts,
  onboarding-journey-api.ts, customer-invitations.ts}`, `packages/core/src/{closing-system.ts,
  customer-journey.ts, sales-enablement.ts, discovery-template.ts}`.
- **Inputs.** Discovery template changes, questionnaire logic, lead/customer schema
  evolution.
- **Outputs.** Schema and API changes with matching security-rule and behavioral test
  coverage (coordinates with the Firebase Agent when a new collection is introduced).
- **Decision rights.** May author and self-review changes within its owned paths that
  don't touch an actual send path.
- **Hard constraints.** Never implements or wires up an actual outbound send (email,
  WhatsApp, SMS) — those stay draft-only artifacts pending Owner approval, matching the
  existing "no AI selling" / human-first policy documented in
  `docs/ARCHITECTURE.md` §10.
- **Escalation.** Any change that would let a workflow event fire without a verified
  `dealClosedAt` check escalates immediately — this is the single most safety-critical
  invariant in the sales pipeline.

### 4.5 Website Builder Agent

- **Mandate.** Two lanes under one agent, since both are "building the product's UI
  surfaces": (A) the pipeline that assembles and ships *customer* websites, and (B) the
  staff/customer dashboard application itself. The original proposal left lane B
  unowned by claiming Architecture and Content "shared" it — neither agent's ownership
  list ever actually included it; that inconsistency is fixed here by assigning it
  explicitly.
- **Owns — Lane A (customer-site pipeline).** `packages/core/src/{
  published-content-runtime.ts, project-factory.ts, website-content.ts}`,
  `functions/src/{website-content-api.ts, deployment-record.ts}`.
- **Owns — Lane B (dashboard application).** `apps/web/src/{app,components,lib}/**`
  not otherwise claimed by another agent's copy/content mandate (Content Agent, §4.10,
  still owns prose/copy quality within these files; this agent owns their structure,
  behavior, and data-layer code — routes, components, `lib/live-data.ts`, `lib/api.ts`,
  `lib/auth.tsx`, `lib/organization.tsx`, the i18n dictionary *system* as opposed to
  dictionary *content*).
- **Inputs.** Changes to the published-content resolution/fallback logic, content
  field schemas, deployment-record parsing (Lane A); route/component/data-layer changes
  to the dashboard (Lane B).
- **Outputs.** Runtime and content-pipeline changes with matching resilience-path test
  coverage (the fallback-to-bundled-content behavior in particular must never regress);
  dashboard changes with matching route-smoke test coverage.
- **Decision rights.** May author and self-review within owned paths, in either lane.
- **Hard constraints.** Cannot alter `parseVerifiedDeploymentUrl()`'s HTTPS-only
  enforcement or Storage artifact path sanitization (`safeArtifactPath`) without
  Security Agent review — these are the two chokepoints that stop a compromised or
  malfunctioning agent output from injecting an arbitrary URL or path.
- **Escalation.** Any change to `project-factory.ts`'s `dry_run`-only execution mode
  escalates immediately — that flag is the only thing currently stopping the
  provisioning planner from calling real GCP APIs.

### 4.6 Security Agent

- **Mandate.** Independent security review — the one role with cross-cutting authority
  over every other agent's output when it touches a security-sensitive path.
- **Owns.** `functions/src/{tool-policy.ts, tool-gateway.ts, rate-limit.ts,
  security-headers.ts, staff-admin-api.ts}`, `scripts/sync-csp.mjs`, and
  `automation/policy.json`'s `protectedCategories` definitions themselves.
  `tool-gateway.ts` is explicitly in scope, not just the policy table that governs it —
  it contains the connector that shells out to `firebase deploy --only hosting` via
  Cloud Build, so this agent's review is the second line of defense (after DevOps's own
  hard constraint, §4.8) against that path ever running unattended. `staff-admin-api.ts`
  is in scope because it holds the owner-only MFA-reset and role-escalation logic — the
  exact shape of change this agent exists to review.
- **Inputs.** Any PR whose diff touches a path on the security-sensitive list, or whose
  keywords match a `protectedCategories` entry.
- **Outputs.** A required review verdict, run through the same `security-review` skill
  used for human-triggered reviews.
- **Decision rights.** Can block a merge on any PR regardless of which agent authored
  it, if the diff touches its trigger list.
- **Hard constraints.** Never authors the feature it is reviewing in the same PR —
  structurally identical to QA's non-self-review rule. Cannot itself loosen
  `protectedCategories` — that specific change is, by definition, PROTECTED and routes
  to Isaac.
- **Escalation.** Any diff that adds a new tool-policy entry with `approval:"never"` on
  a side-effecting operation, or that changes SSRF/idempotency/path-sanitization logic
  in `ToolGateway`, escalates immediately.

### 4.7 QA Agent

- **Mandate.** Formalizes the role that already exists as `ROLE_QA_SAFETY` in
  `automation/lib/route.mjs` — independent verification of every SAFE PR before it can
  be labeled ready for merge.
- **Owns.** All test suites across the three workspaces, `.github/workflows/ci.yml`
  (review only — see DevOps for authorship), `dispatch-qa-review.mjs`.
- **Inputs.** Every open, non-draft `autonomous:safe` PR without an existing QA label.
- **Outputs.** `autonomous:qa-passed` or `autonomous:qa-changes-requested`.
- **Decision rights.** Sole authority to grant the QA label; no PR reaches
  `autonomous:ready-for-merge` without it.
- **Hard constraints.** Structurally cannot review its own or a same-session PR — the
  dispatcher always requests a fresh session for QA, never the author's.
- **Escalation.** A PR that fails QA twice on the same finding escalates to the CEO/
  Manager agent for reassignment rather than a third automatic retry.

### 4.8 DevOps Agent

- **Mandate.** Keep build, deploy, backup, and CI tooling healthy without ever
  executing a deploy itself.
- **Owns.** `firebase.json` (deploy-relevant sections), `package.json` scripts,
  `scripts/backup-verification/`, `functions/src/{backup.ts, backup-policy.ts,
  watchdog.ts, watchdog-policy.ts, queue-recovery.ts}` — the running functions the
  verification scripts check, not just the scripts themselves — and *proposals* for
  `.github/workflows/*` (see constraint below).
- **Inputs.** CI failures, build-script drift, backup/restore-drill scheduling needs,
  watchdog/queue-recovery alerts.
- **Outputs.** Tooling PRs; restore-drill evidence reports (read-only, per
  `docs/ARCHITECTURE.md` §11); rollback proposals (see below).
- **Decision rights.** May author and self-review changes to backup-verification
  scripts, backup/watchdog/queue-recovery source, and non-deploy build tooling.
- **Hard constraints.** **Never runs `firebase deploy` or `npm run deploy`.** Cannot
  write directly to `.github/workflows/` — the Claude Code GitHub App is denied that
  permission by design, so any workflow change goes through the documented human-copy
  procedure in `automation/workflow-templates/README.md`. This is an intentional
  limitation, not a gap to close.
- **Production rollback workflow.** When an already-merged, agent-authored change needs
  reverting in production, this agent's job stops at *proposing* the rollback — it
  identifies the affected service and drafts the fix using the matching playbook in
  `docs/disaster-recovery-runbook.md` (Hosting: `firebase hosting:clone` to the prior
  release; Functions/Firestore rules: redeploy the prior commit). Isaac executes it,
  exactly as any other deploy — a rollback is not an approval exception, it's still a
  production-changing command under `CLAUDE.md`.
- **Escalation.** Any change to the deploy order, the `deploy`/`deploy:hosting`
  scripts, or anything matching the `firebase-cloud-production` keyword category
  escalates immediately and is never auto-classified SAFE.

### 4.9 AI Agent

- **Mandate.** Own execution-mode gating, model routing, prompt governance, and AI
  budget/concurrency logic.
- **Owns.** `functions/src/{model-providers.ts, ai-execution-mode.ts,
  provider-mode.ts}`, strictly the model-selection/execution slice of
  `orchestrator.run()` (the call into `routeModel()` and `executeModel()` and their
  immediate error handling — everything else in `orchestrator.ts` belongs to the
  Architecture Agent, §4.2), `packages/core/src/model-router.ts`,
  `packages/core/src/agents/definitions.ts` (prompt content). Does **not** own
  `budget.ts` or `cost.ts` — those are cross-cutting accounting modules owned by the
  Analytics & Observability Agent (§4.12); this agent consumes their gate functions but
  needs that agent's sign-off to change them.
- **Inputs.** Prompt updates, routing/fallback logic changes, budget-governance
  tuning.
- **Outputs.** Prompt/routing PRs with before/after evaluation against representative
  tasks, per the governance note in `prompts/README.md`.
- **Decision rights.** May author and self-review prompt content changes that don't
  touch execution-mode gating.
- **Hard constraints.** Any change to `resolveAiExecutionMode()`'s fail-safe logic, or
  to the `AI_EXECUTION_MODE_APPROVAL` sentinel check, is automatically PROTECTED
  (money + production-infrastructure categories) — no exceptions, no matter how small
  the diff looks.
- **Escalation.** Any change that would let `api` mode activate in production without
  both `AI_EXECUTION_MODE` and `AI_EXECUTION_MODE_APPROVAL` independently agreeing
  escalates immediately.

### 4.10 Content Agent

- **Mandate.** Draft copy, documentation prose, and customer-message templates — never
  send anything.
- **Owns.** `packages/core/src/israel-localization.ts` (message templates),
  `docs/CUSTOMER-COMMUNICATION-LIBRARY.md`, general documentation prose quality across
  `docs/`.
- **Inputs.** New template requests, documentation gaps, prose-quality review
  requests.
- **Outputs.** Draft templates and docs, always explicitly marked as drafts pending
  Owner approval where customer-facing.
- **Decision rights.** May author and self-review documentation-only changes.
- **Hard constraints.** Never wires a template into an actual send path — identical
  constraint to the product's own Content agent, applied here to the codebase that
  defines those templates.
- **Escalation.** None specific to production safety — its output is inert by
  construction (text, not executable send logic).

### 4.11 Sales & Business Agent

- **Mandate.** Keep codified business policy consistent with the policy documents that
  describe it — formalizes the existing `businessOpsCategories` role.
- **Owns.** `docs/company/*`, `packages/core/src/{business-rules.ts, pricing.ts,
  finance.ts, legal.ts}`, `functions/src/{document-api.ts, document-renderer.ts,
  enterprise-api.ts}` (the legal-document and pricing portions specifically — the
  project-factory portion of `enterprise-api.ts` is reviewed jointly with the Website
  Builder Agent, §4.5, which owns `project-factory.ts` itself).
- **Inputs.** Business-rule drift detection (e.g., the SLA-constant duplication
  already flagged in `docs/ARCHITECTURE.md` §13 between `operations.ts` and
  `business-rules.ts` — this agent holds standing responsibility for catching that
  specific class of drift between codified constants and their `docs/company/`
  descriptions), pricing/margin policy documentation, legal-document template changes.
- **Outputs.** Reconciliation PRs and policy-documentation updates; legal-document
  template/versioning changes.
- **Decision rights.** May flag drift and propose a fix; may not change the
  zero-discount-without-approval invariant or margin targets without Isaac, since those
  are commercial policy, not implementation detail.
- **Mandatory co-review.** Any change to `document-api.ts`/`document-renderer.ts`'s
  SHA-256 integrity-hash verification or e-signature capture logic requires the
  Security Agent's sign-off (§4.6) before merge — this agent owns the legal *content*
  and workflow, not the cryptographic guarantees around it.
- **Hard constraints.** Explicitly forbidden from claiming any external contact or
  action — this role never touches a customer, a vendor, or a payment, only the
  internal documents and constants that describe policy.
- **Escalation.** Any proposed change to `maximumDiscountPercentWithoutOwnerApproval`
  or `minimumTargetGrossMarginPercent` escalates immediately — these are schema-level
  invariants today, not just defaults, and changing them is a business decision.

### 4.12 Analytics & Observability Agent *(recommended addition — not in the original 11)*

The completeness review found 11 source files — `reports.ts`, `business-intelligence.ts`,
`business-intelligence-api.ts`, `command-center-api.ts`, `platform-master-api.ts`,
`fleet.ts`, `fleet-api.ts`, `operations-health.ts`, `observability.ts`, `budget.ts`,
`cost.ts`, plus `report-api.ts` — that don't belong under any of the 11 originally
requested roles without distorting one of them. Rather than force-fit this cluster
into an ill-suited owner, this document proposes a 12th role and flags it explicitly
as a recommendation pending Isaac's decision (see §9).

- **Mandate.** Own the reporting, business-intelligence, infrastructure-health, and
  cost/budget-accounting layers — the modules every other agent's dashboards and gate
  functions read from, but none of them should individually own.
- **Owns.** `packages/core/src/{reports.ts, business-intelligence.ts, fleet.ts,
  operations-health.ts, budget.ts}`, `functions/src/{business-intelligence-api.ts,
  command-center-api.ts, platform-master-api.ts, fleet-api.ts, report-api.ts,
  observability.ts, cost.ts}`.
- **Inputs.** New KPI/reporting requests, health-scoring rule changes, cost-accounting
  drift (e.g., unpriced-usage entries flagged by `operations-health.ts` itself).
- **Outputs.** Reporting/aggregation PRs; periodic accuracy checks that dashboard
  numbers (`platform-master-api.ts`'s cross-org rollup in particular) still match their
  source collections.
- **Decision rights.** May author and self-review within owned paths.
- **Hard constraints.** Read-only with respect to the collections it aggregates —
  this agent never writes business data, only computes derived views over it. Cannot
  change `budget.ts`'s gate thresholds without the AI Agent's (§4.9) and Sales &
  Business Agent's (§4.11) sign-off, since those thresholds are simultaneously an AI
  safety control and a commercial policy.
- **Escalation.** Any change to `platform-master-api.ts`'s cross-org data-access scope
  escalates immediately — it is the single broadest read surface in the codebase and a
  regression there is a tenant-isolation risk, not just a reporting bug.

---

## 5. Communication and delegation model

1. **Classification stays centralized and unchanged.** `automation/policy.json`'s
   SAFE/PROTECTED decision tree runs first, before any specialist is chosen — the
   6-category PROTECTED keyword scan and the "unapproved defaults to PROTECTED" rule
   apply identically no matter which of the 11 roles would eventually own the work.
2. **Routing widens, it doesn't replace.** `automation/lib/route.mjs::determineRole()`
   currently resolves 2 roles by keyword; this proposal extends its table to 11 and
   introduces one `autonomous:role-<name>` label per specialist, following the existing
   naming pattern (`role-developer`, `role-business-ops` → 9 new labels).
3. **File ownership resolves ambiguity.** The per-agent "Owns" path lists in §4 double
   as a CODEOWNERS-style table. A diff that only touches one agent's paths is
   single-owned; a diff crossing two agents' paths (e.g., a Firestore rules change that
   also reshapes CRM data) is dual-labeled and requires both owners' sign-off before
   QA is requested.
4. **Dispatch reuses existing infrastructure.** The CEO/Manager agent still posts a
   role-specific `@claude` trigger comment through `claude.yml` — no new GitHub App
   permissions, no new workflow surface.
5. **The status board scales without changing its shape.** `report-status.mjs` renders
   one queue per role instead of two; `maxConcurrentWorkers` remains a single global
   cap across all 11 (or 12) roles, not a multiplier per role.
6. **Overlapping-claim handling.** Widening from 2 roles to 11–12 raises the odds of two
   agents independently touching the same file in the same window (dual-labeling per
   point 3 handles *known* boundary crossings; this handles *unplanned* collisions).
   The dispatcher (CEO/Manager agent) claims work at the issue level, not the file
   level, so two agents should never be simultaneously assigned overlapping files by
   design — but if `check-merge-eligibility.mjs` detects a PR is no longer
   fast-forwardable against `main` because another merged PR touched the same lines,
   it labels the PR `autonomous:blocked` (reusing the existing worker-health mechanism,
   `docs/ARCHITECTURE.md` §8) rather than attempting an automatic rebase — a human
   resolves the conflict.
7. **Role lifecycle.** Adding a role beyond this document's 11 (or 12, if §4.12 is
   adopted) is itself a change to `automation/policy.json` and therefore PROTECTED —
   it routes to Isaac like any other policy change (§3, principle 2), and this document
   must be updated in the same change per its maintenance banner. Retiring a role
   (e.g., if a specialist proves consistently idle) follows the same path: propose the
   removal, get Isaac's approval, fold its owned paths back to the CEO/Manager agent's
   default classification (or an adjacent role) rather than leaving them ownerless.

## 6. Review model

Three tiers, layered onto the existing merge-eligibility gate rather than replacing it:

| Tier | Who | When | Required for merge? |
|---|---|---|---|
| 1. Domain-owner review | The owning agent (self-review) | Every PR | Yes — implicit when the PR is single-owned |
| 2. Cross-domain sign-off | The second owning agent | Only when a diff crosses ownership boundaries | Yes, when applicable |
| 3. Independent QA | A fresh QA Agent session, never the author's | Every SAFE PR | Yes — unchanged from today |
| 3b. Security review | The Security Agent | Only when the diff touches its trigger list (§4.6) | Yes, when applicable — new conditional gate |

No tier grants merge authority itself — `autonomous:ready-for-merge` remains an
informational label; `gh pr merge` is never called by any script, at any tier. A human
merges, always.

## 7. Production safety enforcement

This section intentionally repeats points already made above, because it is the one
part of this blueprint that must never drift by omission:

- The six PROTECTED keyword categories in `automation/policy.json` apply identically
  to all 11 roles (12, if §4.12 is adopted). No role — including DevOps and AI, the two
  most likely to touch PROTECTED paths day-to-day — gets a standing exemption.
- `CLAUDE.md`'s requirement for fresh, current-turn, scope-specific approval before any
  production-changing command governs every agent session equally, regardless of role
  label.
- `gh pr merge` is never invoked anywhere in this design.
- A policy change to `automation/policy.json` itself — including one that would add,
  remove, or reweight a PROTECTED category, or add/retire an agent role (§5, point 7)
  — is itself PROTECTED and routes to Isaac, never self-authorized by the CEO/Manager
  agent that interprets the policy.
- A production rollback is not an approval exception. Whether triggered by DevOps's
  proposal (§4.8), the CEO/Manager agent's escalation, or a direct human request,
  reverting an already-deployed change still requires the same fresh, current-turn,
  scope-specific approval as any other production-changing command — even when the
  situation is urgent. Urgency changes how fast Isaac is asked, never whether he is
  asked.

## 8. Implementation plan

Phased, and no phase beyond documentation has been executed as of this writing.

| Phase | Change | Files touched | Risk |
|---|---|---|---|
| 1 | This document | `docs/MULTI-AGENT-DEV-TEAM.md`, a cross-link added to `docs/ARCHITECTURE.md` | None — docs only |
| 2 | Extend `automation/policy.json` with 11 (or 12, per §9 Q4) role-keyword categories and the path-ownership table from §4 | `automation/policy.json` | Low — pure config, same shape as today's 2-role table |
| 3 | Extend `determineRole()` to route among the new roles | `automation/lib/route.mjs` + its test file | Low — pure function, unit-tested like the existing 2-role version |
| 4 | Add the new `autonomous:role-*` labels (9 or 10, per §9 Q4) | `ensure-labels` job (`.github/workflows/autonomous-manager.yml` template) | None — idempotent label creation |
| 5 | Add the conditional Security-review gate | `automation/check-merge-eligibility.mjs` + tests | Low-medium — touches merge-eligibility logic; needs new test coverage before merge |
| 6 | Per-role status-board rendering | `automation/report-status.mjs` | None — presentational |

Explicitly out of scope for every phase above: `CLAUDE.md`, the PROTECTED
hard-keyword list, and anything in the deploy path. Those stay exactly as they are.

## 9. Open questions for Isaac

These are decisions this document deliberately leaves to the repository owner rather
than presupposing:

1. Should the 9 new role labels be introduced all at once, or rolled out incrementally
   (e.g., Security and DevOps first, since they carry the most PROTECTED-adjacent
   surface)?
2. Should cross-domain dual-ownership (§5.3) block merge on *both* sign-offs, or is a
   single owning agent's review sufficient with the second agent notified but not
   blocking?
3. Does the Security Agent's review authority (§4.6) need its own escalation path
   distinct from the general PROTECTED queue, given how much of the codebase's
   trigger list it covers?
4. Should the Analytics & Observability Agent (§4.12) be adopted as a 12th standing
   role, or should its 11 owned files instead be distributed across the existing
   roster (e.g., `fleet.ts`/`fleet-api.ts` to DevOps, `budget.ts`/`cost.ts` to AI)?
   This document defaults to recommending a 12th role because none of the existing
   11 have that cluster's read-heavy, cross-cutting shape, but the alternative avoids
   growing the roster past what was originally requested.
5. The Website Builder Agent (§4.5) now carries two lanes — the customer-site
   generation pipeline and the staff/customer dashboard application. Should these
   split into two roles if the dashboard surface grows, or does the shared "building
   the product's UI" framing hold indefinitely? No immediate action needed; flagged
   here so the decision isn't made by default inertia later.
