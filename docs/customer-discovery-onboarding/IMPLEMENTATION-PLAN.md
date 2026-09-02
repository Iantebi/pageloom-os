# Business Discovery — Implementation Plan

Companion to [`PRD.md`](./PRD.md). Every phase below is local-only (code + tests +
local build), gated by `npm run check` passing, and produces no production-affecting
side effect. **No phase includes a deploy step.** Deployment of any kind requires the
fresh, current-turn, scope-specific approval defined in the repository's `CLAUDE.md` —
that approval is requested separately, after all phases are complete and reviewed, not
folded into any phase here.

## Phase 0 — Repository audit

**Status: done**, this pass. Findings are what the rest of this document, and every
other file in this directory, are built on. No further action.

## Phase 1 — Core data model & template

**Objective**: `packages/core` gains the Discovery template, types, and pure validation
logic, fully unit-tested, with zero Firestore/API/UI involvement yet.

**Files**: `packages/core/src/discovery-template.ts`, `packages/core/src/discovery.ts`,
`packages/core/src/discovery-template.test.ts`.

**Work**:
- `discoveryTemplate` — all 9 sections, full question list per `UX-FLOW.md` §5, every
  question typed with a `semanticTag`.
- `isQuestionVisible`, `missingRequiredDiscoveryFields`, progress-percent helper.
- Zod schemas for API payloads: `saveDiscoverySectionSchema`,
  `completeDiscoverySectionSchema`, `submitDiscoverySchema`, `reopenDiscoverySectionSchema`,
  `discoveryNoteSchema`.
- `BusinessProfileDocument` type (schema only, §`DATA-MODEL.md` §4).

**Dependencies**: none — this phase can start immediately.

**Tests**: conditional visibility (each `visibleIf` rule from `DATA-MODEL.md` §3.4),
required-field detection with and without conditional skips, progress math, schema
parsing rejects malformed payloads (mirrors `workflow.test.ts`'s and
`client-management`'s existing test style).

**Definition of done**: `npm run test --workspace=@pageloom/core` passes; no other
workspace touched yet.

## Phase 2 — Firestore & Storage rules

**Objective**: add the exact rule blocks from `SECURITY.md` §3 and §5 to
`firestore.rules`/`storage.rules`, extend the behavioral emulator test suites.

**Files**: `firestore.rules`, `storage.rules`,
`functions/src/firestore-rules.behavioral.test.ts`,
`functions/src/storage-rules.behavioral.test.ts` (extend existing fixtures, do not fork
new files).

**Dependencies**: Phase 1 (for collection/field names to reference in test fixtures).

**Tests**: new fixtures proving — assigned client can read own `discovery/*`; a
different org's client cannot; `discoveryNotes` is unreadable by any `client` role
identity regardless of project assignment; disabled member is rejected; staff can read
everything. This is the phase where the audit's own warning ("36 passing string-match
tests still shipped a real permission bug") is most directly relevant — **rely on the
behavioral suite, not the string-match suite, as the actual gate.**

**Definition of done**: `npm run test:behavioral --workspace=@pageloom/functions`
passes locally against the emulator (`firebase emulators:exec --project
demo-pageloom-rules-fs --only firestore,storage "npm run test:behavioral ..."`, matching
CI's exact invocation).

## Phase 3 — API layer (`discovery-api.ts`)

**Objective**: the full route set from `SECURITY.md` §4, mounted into the existing
Express app.

**Files**: `functions/src/discovery-api.ts`, `functions/src/discovery-api.test.ts`,
one-line mount addition in `functions/src/api.ts` or `index.ts` (wherever
`onboardingJourneyRouter` is mounted).

**Dependencies**: Phase 1 (schemas), Phase 2 (rules must exist so tests can assert
against real access behavior, though route tests themselves typically run against the
Functions emulator with rules active per the existing `customer-lifecycle.e2e.test.ts`
pattern).

**Work — done, approved**: implement each route from `SECURITY.md` §4; the
`onboarding-journey-api.ts` payment-confirmation handler change described in
`ARCHITECTURE.md` §3 (initializes `discoveryProgress` **instead of** auto-creating the
Website Brief — `PRD.md` §37 decision 1 is resolved and approved); notification write
sites for `discovery_submitted`/`discovery_information_requested`; activity/audit writes
per `SECURITY.md` §7.

**Tests**: route-level tests matching `closing-api.test.ts`'s/`onboarding-journey-api`'s
existing style — happy path per route, role-rejection per route, cross-project rejection,
idempotency of `complete`/`submit` (calling twice doesn't double-emit workflow events or
double-write notifications, matching the existing `QuestionnaireCompleted`-path
idempotency pattern).

**Definition of done**: `npm run test --workspace=@pageloom/functions` passes;
`npm run typecheck` passes end-to-end (core → functions → web, per the root script
chain).

## Phase 4 — Customer Discovery UI

**Objective**: the full customer-facing flow from `UX-FLOW.md` §2–§4.

**Files**: `apps/web/src/components/discovery/*` (per `ARCHITECTURE.md` §2),
`apps/web/src/lib/i18n/dictionaries/discoveryQuestions.ts`,
`apps/web/src/lib/i18n/dictionaries/discoveryShell.ts`, registration in
`apps/web/src/lib/i18n/index.ts`, integration point in
`apps/web/src/app/(product)/portal/page.tsx`.

**Dependencies**: Phase 3 (routes must exist to call).

**Work**: stepper, section renderer, per-type question inputs (reusing/extending
`QuestionnaireInput`'s existing type-switch pattern for the 5 new types), autosave hook
(debounce + flush-on-blur/navigate, per `PRD.md` §12), review screen, completion screen,
dashboard task card states (`UX-FLOW.md` §3), "needs more info" banner.

**Tests**: component-level tests where the existing codebase has precedent for them (the
audit found `apps/web` has no dedicated frontend test runner today — confirm whether to
add one or rely on manual verification + the existing e2e/behavioral coverage for the
data layer; **this is a scope question worth a one-line confirmation before starting**,
not a blocking decision). Manual verification checklist: `TEST-PLAN.md` §5.

**Definition of done**: `npm run typecheck --workspace=@pageloom/web` and
`npm run lint --workspaces --if-present` pass; manual walkthrough of all 9 stages +
conditional branches + resume-after-reload + mobile viewport, per `TEST-PLAN.md` §5.

## Phase 5 — Uploads

**Objective**: shared resumable-upload infrastructure, since Discovery is the first
surface needing real progress + preview (per `PRD.md` §14's finding that three existing
upload call sites all use non-resumable `uploadBytes` with no preview).

**Files**: `apps/web/src/lib/hooks/useFileUpload.ts`,
`apps/web/src/components/discovery/FileUploadField.tsx`.

**Dependencies**: Phase 2 (storage rules), Phase 4 (integration point).

**Work**: `uploadBytesResumable` wrapper with progress callback, client-side pre-check
(size/type) before upload starts, thumbnail preview for images via `getDownloadURL`
(first use of this API in the codebase per the audit), retry-without-reselect, per-item
remove (soft, per `UX-FLOW.md` §4.5).

**Explicitly out of scope for this phase**: retrofitting the *existing* three upload
call sites (`portal/page.tsx`'s materials upload, `crm/page.tsx`'s document upload,
`website-content-workspace.tsx`'s media upload) to use the new shared hook. That is a
reasonable follow-up cleanup but is a separate, out-of-scope diff — flagged, not bundled
in, per this project's own "don't add unrelated cleanup to a feature diff" norm.

**Tests**: unit test for the upload hook's state machine (idle/uploading/done/error);
manual verification of large-file rejection, wrong-type rejection, progress bar
accuracy, thumbnail rendering.

## Phase 6 — Backend Master integration

**Objective**: the staff-facing Discovery panel and org-wide overview extension from
`UX-FLOW.md` §6 and `PRD.md` §16. Also the `assets/validate` prefix decision flagged in
`ARCHITECTURE.md` §4.

**Files**: `apps/web/src/components/discovery-panel.tsx`, integration into
`apps/web/src/app/(product)/projects/view/page.tsx`, extension of the
`onboarding-overview` endpoint response shape in `functions/src/onboarding-journey-api.ts`,
and — **only if the product decision in `ARCHITECTURE.md` §4 is made** — a one-line
`allowedPrefix` change in `functions/src/api.ts`'s `assets/validate` handler.

**Dependencies**: Phase 3, Phase 4.

**Tests**: staff can view/reopen/note; a `member`-role (non-privileged staff) identity
is correctly excluded from reopen/note per `SECURITY.md` §4's role matrix; org-wide
overview returns correct aggregate fields for a mix of not-started/in-progress/
submitted projects.

## Phase 7 — Notifications

**Objective**: wire `discovery_submitted`/`discovery_information_requested` end to end.

**Files**: `apps/web/src/lib/i18n/dictionaries/notifications.ts` (add two entries to
`NotificationParamsByType`/`formattersHe`/`formattersEn`), write sites already added in
Phase 3.

**Dependencies**: Phase 3.

**Tests**: notification renders correctly in `NotificationInbox` for both new types, in
both locales; unrecognized/legacy-shape fallback still works (existing `isKnownType`
guard behavior unchanged).

## Phase 8 — PWA / Desktop install

**Objective**: verify, not rebuild. Per `PRD.md` §27, this is already correct.

**Work**: confirm the existing manifest/service-worker/icons continue to work
unaffected by this feature's changes (no new route needs SW caching rules — Discovery's
API calls are dynamic and correctly excluded from the network-only-by-design service
worker). Optionally fix the `theme_color` mismatch flagged in `PRD.md` §27 — **as its
own separate, explicitly-scoped one-line PR**, not bundled here.

**Dependencies**: none (independent verification).

**Tests**: manual — install the app from Chrome/Edge against a local build, confirm
standalone window opens, confirm Discovery pages render correctly inside the installed
window at both mobile and desktop viewport sizes.

## Phase 9 — Tests / security hardening pass

**Objective**: the full `TEST-PLAN.md` suite, run together, plus a final security
self-review against `SECURITY.md` §11's definition of done.

**Dependencies**: Phases 1–7 complete.

**Work**: run `npm run check` (typecheck + test + build) end to end; run
`npm run test:behavioral` and `npm run test:e2e` locally against the emulator, matching
CI's exact commands; manual cross-tenant verification per `TEST-PLAN.md` §3.

**Definition of done**: every command in `TEST-PLAN.md` §6 passes with no regressions
to existing suites.

## Phase 10 — Production readiness (documentation only — no deploy)

**Objective**: everything needed for a human to make the deploy decision, without this
plan or any agent making it.

**Work**: confirm no new Firestore composite index is actually needed (per
`DATA-MODEL.md` §5's analysis) or add the one identified if the org-wide overview
extension needs it; confirm the migration/backward-compatibility posture (`PRD.md` §33)
still holds against the actual final diff; produce a short PR description summarizing
what changed, referencing this document set, for the human reviewer.

**Explicitly not done by this plan**: `firebase deploy` in any form, any Firestore
rules/Storage rules/Functions/Hosting deployment, any IAM/secret change. Per
`CLAUDE.md`, that requires a fresh, explicit, current-turn, scope-specific approval —
requested separately, after this plan's phases are complete and reviewed.

## Sequencing summary

```
Phase 0 (done) → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
                                                    ↘         ↙
                                                    Phase 6
                                                       ↓
                                                    Phase 7
                                                       ↓
                                          Phase 8 (parallel, independent)
                                                       ↓
                                                    Phase 9
                                                       ↓
                                                    Phase 10 (docs only)
```

Phases 1–3 are strictly sequential (each depends on the prior). Phases 4 and 5 can
overlap once Phase 3 lands. Phase 8 has no dependency on any other phase and can run at
any point. Nothing in this plan authorizes skipping a phase's tests to move faster —
every phase's "definition of done" is a hard gate, matching this repository's existing
engineering norms (CI enforces the same tests/build/behavioral/e2e gate on every PR
today with no exceptions).
