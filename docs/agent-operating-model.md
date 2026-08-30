# PageLoom Agent Operating Model

This document describes how Isaac gives PageLoom's engineering assistant (Claude Code,
operating as "PageLoom Lead Engineer") a single high-level mission and how that work gets
broken down, executed, and reported back — without inventing new infrastructure beyond
what already exists in this repository and in Claude Code itself.

This is a coordination model, not a new system to build. Two agent layers already exist
and are reused here rather than duplicated:

1. **PageLoom's own in-product AI agents** (`packages/core`'s `agents` list, executed by
   `functions/src/orchestrator.ts`'s `CentralOrchestrator`) — these run *inside* the
   deployed product, working on customer projects (research, design, copywriting,
   development, QA, etc.). They are not engineering tools; they are the product's own
   agentic workforce for building customer websites.
2. **Claude Code's own subagent types** (`Explore`, `general-purpose`, `Plan`, and any
   others available in a given session) — these are the actual mechanism for delegating
   *engineering* work. The specialist roles below map onto these, used deliberately
   rather than spawned for every small task (per Claude Code's own operating guidance:
   don't spawn agents unless the work genuinely benefits from parallelism or isolation).

## Roles

**PageLoom Lead Engineer (the primary session)** — coordinates everything below. Holds
the full context of a mission, decides what can proceed autonomously versus what needs
Isaac, and is the only one that talks to Isaac directly. Specialist work is delegated via
Claude Code's `Agent` tool when a task is genuinely large/independent enough to warrant
it (e.g., a broad multi-file investigation); otherwise the Lead Engineer does it directly
with its own tools (Read/Grep/Bash/etc.) — most of the work in a mission like this one
(read-only audits, targeted code fixes, running tests) doesn't need delegation at all.

| Specialist | Scope | When to delegate to it |
|---|---|---|
| **Security** | Firestore/Storage Rules, tenant isolation, RBAC, rate limiting, AI budget/concurrency guards, CSP | A dedicated rules/security review spanning many files, or verifying a specific attack scenario end-to-end |
| **Backend** | Cloud Functions (`functions/src`), API authorization, workflow engine, orchestrator | A backend bug investigation or a multi-endpoint feature that's independent of the current thread of work |
| **Frontend/UI** | `apps/web`, appearance/theme system, RTL, PWA | A UI feature or visual regression sweep that doesn't need to interleave with backend work |
| **QA** | Test suites, behavioral rules tests, CI | Running/diagnosing the full test matrix in parallel with other work, or a dedicated bug-hunt pass |
| **Firebase/Cloud** | IAM, billing, Cloud Scheduler, Cloud Functions deployment config, Cloud Monitoring | An infrastructure investigation (like Mission 1 in this report) that's mostly `gcloud`/REST API read-only work |
| **Backup/DR** | Backup architecture, restore procedures, the disaster-recovery runbook | A dedicated DR audit or a real restore-verification drill |
| **Customer Operations** | The lead→proposal→contract→payment→onboarding→support pipeline | A full customer-journey audit, or diagnosing a specific stuck deal/project |

In practice, for a single-session mission like this one, the Lead Engineer usually *is*
each specialist in turn — reading the relevant code, running the relevant checks, making
the relevant fix — rather than spawning seven separate agents for seven mission sections.
Delegation is for when a sub-task is large enough that isolating its context genuinely
helps (matches Claude Code's own guidance: a fresh agent for open-ended, many-file
investigation; direct tool use for everything else).

## Delegation rules

- Default to doing the work directly. Spawn a subagent only when a task is broad,
  open-ended, and independent enough that a fresh, focused context would do it better
  than continuing to accumulate context in the main thread.
- When delegating, brief the subagent like a colleague walking in cold: what's being
  investigated/built, what's already known, what "done" looks like, and where to report
  findings back to.
- A subagent's own findings get synthesized by the Lead Engineer before reaching Isaac —
  Isaac never receives raw, unreviewed subagent output.

## Escalation rules (when the Lead Engineer stops and asks Isaac)

Per `CLAUDE.md`'s production approval gate plus the mission's own stated boundaries:

1. **Any production-changing action** — a Firebase deploy of any kind, an IAM/billing
   change, a repository-secret write. Requires a fresh, current-turn, scope-specific
   approval from Isaac. Never inferred from earlier approvals, plans, or "continue."
2. **Irreversible or destructive actions** — deleting data, force-pushing, disabling a
   security control.
3. **Interactive Google/GitHub authentication** — anything requiring a browser sign-in
   only Isaac can complete.
4. **A material business decision that can't be safely inferred** — e.g., exactly which
   Stripe event should auto-advance which deal stage (a real gap identified in Mission 6
   of the accompanying report; deliberately not auto-implemented, since guessing the
   business rule wrong would silently misroute real customer payments).
5. Anything the Lead Engineer is **genuinely unsure** falls into 1–4 — treated as an
   escalation by default, not resolved by best guess.

Everything else — reading code, running tests, local/repository fixes, read-only
production verification, writing documentation — proceeds without asking.

## How Isaac starts a mission

A single high-level instruction in the Claude Code session, in the repository's working
directory (`C:\Users\Isaac a\Documents\GitHub\pageloom-os`). No special ceremony beyond
that — the Lead Engineer reads `CLAUDE.md` automatically (Claude Code loads it every
session) and treats its production-approval gate as binding regardless of how the mission
is phrased.

## How progress is recorded

- **Git commits** are the primary progress record for anything code/doc-related — each
  logical fix or documentation update lands as its own commit with a message explaining
  *why*, pushed to `origin/main` as it's completed (not batched to the end), so Isaac (or
  a future session) can see exactly what changed and when via `git log`.
- **This report format** (the "FINAL REPORT" section of a mission like this one) is the
  human-readable summary: what's done, what's verified, what's fixed, what's still open,
  and — critically — what needs Isaac's explicit approval before it can go further.
- Nothing is marked complete that wasn't actually verified (tests run, logs checked,
  builds succeeded) — a claim of completion without verification is treated as a defect
  in the report itself.

## How agents hand work to one another

Since a single Lead Engineer session typically plays every specialist role in sequence
for a mission of this size, "handoff" mostly means: finish investigating one area, record
what was found (in commit messages and/or updated docs like the DR runbook), then move to
the next area with that context already committed to the repository rather than held only
in conversation memory. This means a *future* session (or a delegated subagent) can pick
up any specialist thread by reading the repository state and its documentation — the
repository itself is the shared memory between "agents," not an ad hoc handoff message.

When work genuinely is delegated to a subagent mid-mission, the handoff is explicit: the
Lead Engineer's prompt to the subagent states the specific scope, what's already known,
and what to report back; the subagent's result is reviewed and synthesized before the
Lead Engineer continues or reports to Isaac — matching Claude Code's own subagent
guidance (self-contained prompts, trust-but-verify on results).
