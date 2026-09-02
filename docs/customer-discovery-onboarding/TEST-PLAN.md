# Business Discovery — Test Plan

Companion to [`PRD.md`](./PRD.md), [`SECURITY.md`](./SECURITY.md), and
[`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md). Extends the existing test
pyramid — no new test framework, no new CI job type.

## 1. Existing test infrastructure this plan reuses

| Layer | Framework | Location | What Discovery adds |
|---|---|---|---|
| Pure-logic unit tests | Vitest | `packages/core/src/*.test.ts` | `discovery-template.test.ts` |
| API route tests | Vitest | `functions/src/*.test.ts` | `discovery-api.test.ts` |
| Firestore/Storage rules — string-match | Vitest | `functions/src/firestore-rules.test.ts` / `storage-rules.test.ts` | New assertions for the two new rule blocks — **advisory only**, per the audit's own finding that this layer alone once let a real bug ship |
| Firestore/Storage rules — behavioral (real emulator) | Vitest + `@firebase/rules-unit-testing` | `functions/src/firestore-rules.behavioral.test.ts` / `storage-rules.behavioral.test.ts` | New fixtures within the existing files — **this is the real gate** |
| End-to-end | Vitest + Functions/Firestore/Storage/Auth emulators | `functions/src/customer-lifecycle.e2e.test.ts` | New scenario extending the existing payment→questionnaire→assets walkthrough to cover Discovery's submit path |
| Frontend | none today (confirmed by audit — `apps/web` has no test script) | — | Manual verification checklist (§5), not a new automated layer, unless a scope decision adds one (`IMPLEMENTATION-PLAN.md` Phase 4) |

## 2. Unit tests (`packages/core`)

`discovery-template.test.ts`, mirroring `workflow.test.ts`'s pure-function style:

- `isQuestionVisible` — every `visibleIf` rule from `DATA-MODEL.md` §3.4, both the
  positive and negative case, plus a question with no `visibleIf` is always visible.
- `missingRequiredDiscoveryFields` — a required-but-hidden question is never reported
  missing; a required-and-visible question with an empty/undefined/empty-array value is
  reported; a `file`/`file_repeater` question is satisfied only when its response array
  is non-empty.
- Progress percent — 0/9, 1/9, 9/9, and confirms navigating a section without completing
  it never changes `completedSectionIds`.
- Every question in `discoveryTemplate` has a `semanticTag` — a static structural test
  that would fail to compile if the type didn't already guarantee it, kept as a
  belt-and-suspenders runtime assertion in case the type is ever loosened.
- `submitDiscoverySchema`/`saveDiscoverySectionSchema` reject malformed payloads
  (oversized strings, wrong types, unknown fields) — matching `client-management.ts`'s
  existing zod-schema test style.
- Template version stability: a snapshot-style test that fails loudly if a question's
  `id`, `type`, or `required` changes without a matching `DISCOVERY_TEMPLATE_VERSION`
  bump comment/changelog entry — guards `DATA-MODEL.md` §6's versioning policy.

## 3. Behavioral rules tests (extend existing emulator suites)

Following `firestore-rules.behavioral.test.ts`'s existing fixture pattern (owner /
staff-member / two-tier client — unrestricted vs. `projectIds`-restricted / disabled
member / platform admin), add for each new collection:

**`discovery/{sectionId}`**
- Assigned client (unrestricted `projectIds`) can `get()` their own project's section →
  succeeds.
- Assigned client (restricted `projectIds` that excludes this project) → fails.
- A *different* organization's client → fails (the core cross-tenant guarantee).
- Disabled member → fails, even if otherwise would have matched.
- Staff (owner/admin/operator/member) → succeeds regardless of client assignment.
- Any direct client `write()` → fails (rules are read-only by design; mutation is
  API-only).

**`discoveryProgress/current`** — identical matrix to the above.

**`discoveryNotes/{noteId}`** — **the one that must never regress**:
- Staff → succeeds.
- Assigned client on the exact same project → **fails**. This is the single most
  important assertion in the whole Discovery test suite, since it's the enforcement
  point for "customer must never see internal notes" — call this test out by name in PR
  review (`SECURITY.md` §3.3 already flags this).

**`businessProfile/current`**
- Staff → succeeds. Client → fails (staff-only at launch, per `SECURITY.md` §3.4).

**Storage: `organizations/{orgId}/discovery/{projectId}/{sectionId}/{fieldId}/{userId}/**`**
- Assigned client uploading under their own `uid` → succeeds (within size/type limits).
- Assigned client uploading under a *different* `uid` → fails (`safeUpload`'s same-uid
  constraint).
- Oversized file → fails.
- Disallowed content-type → fails.
- Different org's client → fails.
- Staff read → succeeds; staff write → not attempted by staff in normal flow but should
  still be constrained the same way `safeUpload` constrains everyone (no staff bypass
  of the same-uid rule, matching the existing pattern for `questionnaires/...`).

## 4. API integration tests (`functions/src/discovery-api.test.ts`)

Per route in `SECURITY.md` §4:

- **Happy path**: correct role, correct project → 200/201 with expected shape.
- **Role rejection**: wrong role (e.g. `client` calling `reopen`/`notes`) → 403.
- **Cross-project rejection**: authenticated client, valid token, wrong `projectId` →
  403 (not 404 — matches existing `requireProjectAccess` behavior, avoids leaking
  project existence).
- **Validation rejection**: `complete`/`submit` called with required-and-visible
  questions still empty → 422 with the exact missing question ids (not a generic
  message — staff/customer UI needs this to highlight the right fields).
- **Idempotency**: calling `submit` twice does not emit a second `QuestionnaireCompleted`
  event and does not write a second `discovery_submitted` notification — matches the
  existing idempotent-transaction pattern already proven for the Website Brief's
  `complete` endpoint.
- **Workflow integration**: after `submit`, the project's `workflowStage` transitions
  `questionnaire → assets` exactly as it does today via the Website Brief path — this
  is the regression test that proves `ARCHITECTURE.md` §3's "zero changes downstream"
  claim is actually true, not just asserted.
- **Reopen flow**: staff reopens a completed section → section status reverts to
  `draft`, `discoveryProgress.status` becomes `reopened`, previously entered `responses`
  are preserved (not cleared), a `discovery_information_requested` notification is
  written for the customer audience.

## 5. Manual verification checklist (customer + staff UI)

Run against a local dev build (`npm run dev` + `npm run dev:firebase`), using a
dedicated test organization — **never real customer records**, per
`docs/production-release-checklist.md`'s existing house rule, applied here even though
this is local-only work.

**Customer flow**:
- [ ] All 9 stages reachable in order; Previous/Next work at every boundary (can't go
      before stage 1 or past stage 9 without submitting).
- [ ] Every conditional rule from `DATA-MODEL.md` §3.4 shows/hides the right question
      live, without a page reload.
- [ ] Autosave: type into a text field, wait for `נשמר`, reload the page mid-section →
      answer is still there.
- [ ] Autosave failure: simulate a network drop (devtools offline), type, confirm
      `שגיאה בשמירה — נסו שוב` appears and the typed text is not lost; restore network,
      retry succeeds.
- [ ] File upload: image shows a real thumbnail; PDF shows filename+icon; oversized file
      is rejected client-side before any upload attempt; remove-then-reupload works.
- [ ] Service repeater: add/remove/reorder services, no artificial cap below the
      template's `maxItems`.
- [ ] Color-pair picker: select two colors via the visual swatch UI, not free text.
- [ ] Review screen: correctly omits conditionally-hidden questions, edit-links jump
      back into the right section.
- [ ] Submit blocked with a clear, field-specific message if any required-and-visible
      question across any section is still empty.
- [ ] Completion screen renders after successful submit; dashboard task card updates to
      "submitted" state without a manual refresh (live listener).
- [ ] Reopen: as staff, reopen a section with a reason; as that customer, confirm the
      "needs more info" banner shows the reason and links to the right section; resubmit
      works.
- [ ] Mobile viewport (375px): stepper collapses correctly, no horizontal page scroll,
      touch targets are comfortably tappable, keyboard doesn't obscure the active field.
- [ ] RTL correctness: no mirrored icons/arrows pointing the wrong way, no
      physical-left/right leakage (spot-check against the existing logical-CSS-property
      convention).

**Staff flow**:
- [ ] Discovery panel shows accurate per-section status live as the customer progresses.
- [ ] "הצגת תשובות מלאה" shows every answer, marks conditionally-skipped questions as
      "לא רלוונטי" (not blank/missing).
- [ ] Internal note added by staff is never visible when signed in as the test
      customer account (cross-check in a second browser/incognito session).
- [ ] Org-wide onboarding overview shows correct aggregate Discovery status across
      several test projects in different states.

**Cross-tenant manual spot-check** (in addition to the automated behavioral tests in
§3 — a human pass matters here given how load-bearing this guarantee is):
- [ ] Sign in as Organization A's client, attempt to navigate directly to Organization
      B's project's Discovery URL → rejected, no data flash before the rejection.

## 6. Full regression gate

Before considering this feature complete (`PRD.md` §37):

```bash
npm run typecheck
npm run lint
npm test
npm run test:behavioral --workspace=@pageloom/functions   # requires firebase emulators:exec
npm run test:e2e --workspace=@pageloom/functions           # requires firebase emulators:exec
npm run build
```

All must pass with **zero regressions to any existing test** — this feature adds tests,
it does not modify the meaning of any existing one (the Website Brief's own tests must
keep passing unchanged, proving the two systems genuinely coexist per `PRD.md` §33).
This is exactly CI's existing gate (`.github/workflows/ci.yml`) — no new CI job is
introduced; these commands should simply continue to pass when CI runs them against the
final PR.
