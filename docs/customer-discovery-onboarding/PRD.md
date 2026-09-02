# PageLoom Customer Discovery & Onboarding — Product Requirements Document

Status: **Draft for review**. No production deployment, no destructive migration, and no
Firestore/Storage rules deployment happens as a result of this document. See
`IMPLEMENTATION-PLAN.md` for what can proceed locally without further approval and what
requires a product decision first.

Companion documents (do not duplicate content already covered there):
[`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`DATA-MODEL.md`](./DATA-MODEL.md) ·
[`SECURITY.md`](./SECURITY.md) · [`UX-FLOW.md`](./UX-FLOW.md) ·
[`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) · [`TEST-PLAN.md`](./TEST-PLAN.md)

---

## 1. Executive Summary

PageLoom already ships a working, production-integrated customer intake mechanism: the
**Website Brief** — a single flat 22-field form (`packages/core/src/website-brief.ts`),
auto-created the moment an Owner confirms payment, filled out in one sitting in the
Customer Portal, and wired into the real `WorkflowEngine` (`onboarding → questionnaire →
assets`). It works, it is tested, and it should not be thrown away.

It is also not what this mission asks for. The Website Brief asks a business owner to
front-load headline copy, SEO notes, and 22 fields in one long scroll — exactly the
"bureaucratic form" feeling PageLoom's philosophy rejects, and it asks for things
(headline, subheadline) the customer should never have to write. This PRD defines
**Business Discovery**: a 9-stage, one-question-group-at-a-time, autosaving, Hebrew-first
intake experience that replaces the Website Brief's role in the project lifecycle while
reusing every piece of infrastructure underneath it — the same workflow stage, the same
events, the same RBAC, the same notification mechanism, the same Storage rules pattern,
the same versioning idiom already used for document templates and website content.

Business Discovery collects raw business knowledge (facts, stories, real customers, real
objections) instead of marketing copy, tags every answer with a semantic purpose so a
future AI synthesis step can turn it into positioning and page content, and gives
PageLoom Owner/Admin/Operator full visibility and control over the intake through the
existing Master Panel — without ever exposing internal notes to the customer.

**What ships now**: the full 9-stage Discovery data model, the guided customer UI, the
Backend Master review UI, autosave, conditional questions, versioned templates, upload
handling, and a `BusinessProfile` schema ready for AI synthesis. **What does not ship
now**: the AI synthesis step itself, real WhatsApp/SMS/email sending, scheduled reminder
notifications, and any production deployment — all deliberately deferred and called out
in §35 (Open Questions) and `IMPLEMENTATION-PLAN.md`.

## 2. Product Vision

A small business owner who has never had a website should finish Business Discovery
feeling like *"PageLoom now understands my business,"* not *"I filled out a form."* Every
question exists because it lets PageLoom build a page that attracts the right customers,
earns trust faster, and converts more inquiries — never because a field needs to be
filled to satisfy a schema.

## 3. Business Goals

- Replace ad-hoc phone/WhatsApp discovery conversations with a structured, repeatable
  intake that produces AI-ready, semantically tagged data for every project.
- Reduce PageLoom staff time spent re-asking customers for information already given
  once, by making answers resumable, versioned, and visible to every staff member on the
  project.
- Reduce the number of "we're missing X from the customer" round-trips before build can
  start, via section-level completion tracking and staff-side missing-information
  visibility (already partially proven by `missingRequiredQuestionnaireFields`).
- Produce a foundation (`BusinessProfile`) that a future AI step can use to draft
  positioning, page copy, and structure — without PageLoom writing that copy today.
- Keep the platform's existing production-safety and tenant-isolation guarantees intact;
  add zero new categories of risk.

## 4. User Personas

| Persona | Role in system | Needs |
|---|---|---|
| **Business owner (customer)** | `client` member, usually first-time website owner | Simple Hebrew, no jargon, resumable, mobile-friendly, never asked to "write marketing copy" |
| **PageLoom Owner** | `owner` | Full visibility, can reopen sections, request more info, review before build starts |
| **PageLoom Admin/Operator** | `admin` / `operator` | Same operational visibility as Owner minus CEO-only actions (payment confirmation, handover) |
| **Future: AI synthesis step** | system, not a human persona | Structured, semantically tagged input — this PRD prepares its data contract but does not build it |

## 5. Customer Journey

Business Discovery is not a new pipeline; it occupies the **existing** `onboarding →
questionnaire → assets` span of `WorkflowStage` (`packages/core/src/workflow.ts:4-9`),
exactly where the Website Brief lives today. See `docs/customer-journey/FLOW.md` for the
full lifecycle this fits into (`Lead → Closed Won → Payment Confirmed → Welcome →
Website Brief → Materials Collection → ...`) — read "Website Brief" there as the stage
Business Discovery now fills. Full stage-by-stage flow: `UX-FLOW.md` §1.

## 6. Complete Screen Map

See `UX-FLOW.md` §2 for the full inventory (customer + Master Panel, every state).
Summary: 1 dashboard task card, 1 Discovery shell (stepper + 9 section screens + review +
completion), 1 staff Discovery tab (replacing/extending `OnboardingJourneyPanel`'s
materials view), 1 org-wide overview extension.

## 7. Dashboard UX

The existing Customer Portal (`apps/web/src/app/(product)/portal/page.tsx`) already has
the right shape: `WelcomePanel` → `CustomerJourneyTimeline` → task card → questionnaire.
Business Discovery reuses this shell and replaces `CustomerQuestionnaire`'s flat form
with a task card:

> **"אנחנו צריכים להכיר את העסק שלכם"**
> "כדי שנוכל לבנות פתרון שמדבר ללקוחות הנכונים ומציג את העסק בצורה הטובה ביותר."
> CTA: **"התחילו את אפיון העסק"**

`WelcomePanel`'s existing scroll-to-anchor pattern (`#website-brief`) is retargeted to
`#business-discovery`. No new page shell, no new routing pattern — see `UX-FLOW.md` §3.

## 8. Discovery UX

One section at a time, ~3–6 questions per section, large touch targets, previous/next,
auto-save with a visible status word, resumable across devices and sessions, conditional
questions evaluated live, and an optional "ⓘ למה אנחנו שואלים?" toggle per question
(collapsed by default — never a permanent panel). Full interaction spec, mobile behavior,
and component reuse in `UX-FLOW.md` §4.

## 9. The 9 Discovery Stages — evaluated

The mission's proposed order is adopted as-is; it is UX-sound and needs no structural
change:

1. היכרות עם העסק — business intro
2. הלקוחות שלכם — customers
3. השירותים שלכם — services
4. למה בוחרים בכם — differentiation
5. אמון והמלצות — trust & social proof
6. מיתוג וסגנון — branding
7. חומרים ותמונות — materials & media
8. פרטי העסק והנוכחות הדיגיטלית — business info & digital presence
9. המטרה והסיום — goal & completion

**Why this order works**: it moves from soft/narrative (who are you, who do you serve)
to concrete/offering (services, proof) to administrative (branding mechanics, files,
contact logistics) and closes on reflection (goals) rather than paperwork — so the
questionnaire never feels most bureaucratic right when the customer is about to finish.
The one alternative considered — moving stage 8's contact/logistics fields earlier,
next to stage 1 — was rejected because it front-loads the most form-like stage before
any narrative rapport is built, working against the "PageLoom is learning my business"
feeling. Full per-stage question list: `UX-FLOW.md` §5; schema: `DATA-MODEL.md` §3.

## 10. Question Architecture

Every question is a typed, versioned, code-defined record (not customer- or
staff-editable in v1 — see §37 rationale), with a `semanticTag` for future AI mapping and
an optional `visibleIf` condition. Full type definitions: `DATA-MODEL.md` §3.

Supported input types (superset of the existing `questionnaireFieldSchema` used by the
Website Brief, so the two systems share a common core):

`short_text · long_text · email · phone · url · select · multi_select · boolean · date ·
color_pair · file · file_repeater · service_repeater · testimonial_repeater · address ·
social_links`

The last five are new. They exist because the mission explicitly requires dynamic
service lists, a two-color brand picker, repeating testimonials/media, and structured
address/social data — none of which the existing flat `questionnaireFieldSchema` (max:
single files, `long_text` "one per line" lists) can express. This is a deliberate,
scoped extension, not a rewrite: `short_text` through `file` keep the exact same meaning
and validation as the existing Website Brief field types.

## 11. Conditional Logic

A single reusable rule shape, evaluated by one pure function used both client-side (show/
hide) and server-side (required-field validation), so there is exactly one place
conditional logic can be wrong instead of two:

```ts
interface DiscoveryCondition { questionId: string; equals?: string | boolean; notEmpty?: boolean }
// AND semantics across an array; a question with no visibleIf is always visible.
function isQuestionVisible(question: DiscoveryQuestion, responses: DiscoveryResponses): boolean
```

Concrete rules used at launch (§ mission examples), all expressed this way — no
hard-coded `if` statements in a UI component: no existing website → skip website-analysis
questions; no domain → skip domain-configuration questions; no testimonials → offer
"can PageLoom help collect them?" instead of an upload prompt; no logo → mark
branding-assistance needed. Full rule list: `DATA-MODEL.md` §3.4.

## 12. Autosave

Every section is one Firestore document (`.../discovery/{sectionId}`, see `DATA-MODEL.md`
§2). The client debounces text/select/boolean edits (1.5s idle) into a single `PATCH
/projects/:id/discovery/sections/:sectionId` call, plus an immediate flush on
field-blur and on navigation away from the section (`visibilitychange`/route change).
File-type answers save immediately on successful upload, exactly like the existing
Website Brief upload flow (`portal/page.tsx:121-132`) — no debounce needed there since
the write is already atomic and rare.

Visible states (Hebrew, matching mission spec exactly): `שומר…` (saving) → `נשמר` (saved,
with a subtle timestamp) → `שגיאה בשמירה — נסו שוב` (save failed, with a retry action)
persisted until the retry succeeds. A failed autosave never silently drops the customer's
typed text — it stays in local component state and the retry button re-sends the same
payload; this is a explicit product requirement (§ mission "prevent accidental data
loss") and is why autosave is PATCH-idempotent per section rather than a queue of
diffs. Concurrent-session handling: last-write-wins on `updatedAt`, acceptable because a
single customer editing from two devices simultaneously is a rare edge case and the
alternative (operational-transform merging) is unjustified complexity for this data.
Offline: the existing service worker is deliberately network-only for anything dynamic
(`apps/web/public/sw.js`, by design — authenticated multi-tenant data must never be
cached across users on a shared device); Discovery does not change that. A failed
autosave due to no network shows the same retry state described above rather than a
false "offline queue" promise.

## 13. Progress Calculation

`discoveryProgress/current` (singleton, mirrors the `launchChecklist/current`/
`handover/current` idiom) tracks `completedSectionIds: DiscoverySectionId[]`, written
**only** when a section is explicitly marked complete via `POST
/discovery/sections/:id/complete` (server-side required-field validation, same
`isQuestionVisible`-aware logic as §11) — never on mere navigation. `percentComplete =
completedSectionIds.length / 9 * 100`. This directly satisfies "a customer should not
receive completion credit for an empty required stage."

## 14. Upload/Media System

Reuses the existing Storage tenant-isolation and `safeUpload()` rule pattern verbatim,
with a Discovery-specific path prefix:

```
organizations/{orgId}/discovery/{projectId}/{sectionId}/{questionId}/{userId}/{itemIndex}-{uuid}-{fileName}
```

`itemIndex` (0-based) is the one true addition over the existing `.../{fieldId}/{userId}/
{uuid}-{fileName}` convention — it is what lets a `file_repeater` (up to N photos, up to
10 testimonial screenshots, etc.) express "item 3 of 5" without inventing a separate
per-file Firestore metadata collection. Each section's response document stores the
resulting paths as `{ path, fileName, uploadedAt, sizeBytes }[]` per question — the exact
"array of upload records" shape already used informally for `filePaths` today, just
scoped per-question instead of per-questionnaire.

**Formats/limits** (matching the existing global `safeUploadShape()`/`safeWebsiteMedia()`
rule ceiling — see `SECURITY.md` §5 for the exact rule text to add):
- Images (logo, photos, before/after): jpeg/png/webp, **≤10 MB** per file.
- Documents (price lists, brochures): PDF, **≤10 MB**.
- Videos (intro video link is a URL field, not an upload, matching the existing Website
  Brief's `introVideo: url` — no raw video upload in v1, consistent with the 15 MB
  video-upload behavior that exists only for the separately-scoped website-media system).
- Max items per repeater: photos 10, testimonial screenshots 10, documents 5 (mission's
  "up to 10 appropriate images" ceiling is mirrored here for symmetry with the future
  AI-sourcing workflow).

Upload UX (progress, preview, replace, remove, retry) — see `UX-FLOW.md` §4.5, which also
flags a real existing gap: today's uploader uses non-resumable `uploadBytes` with no
progress percentage and no image preview anywhere in the app (confirmed by audit — zero
`getDownloadURL` call sites). Business Discovery is the first surface in this codebase
that needs real upload progress and thumbnail preview; `IMPLEMENTATION-PLAN.md` Phase 5
scopes switching to `uploadBytesResumable` and adding a shared `useFileUpload` hook +
`FileUploadField`/`ImageThumbnail` components, since three separate upload call sites
already duplicate the same logic today and a fourth should not add a fourth copy.

AI-sourced images (mission: "PageLoom may later source or generate up to 10 images"): the
data model supports this without new fields — an image "slot" is satisfied by either a
customer upload or, later, a system-authored entry distinguished by `source: "customer" |
"ai_generated"` on the upload record (field added now, unused until that feature is
separately approved).

## 15. Notifications

Two new notification types, added the same way every existing type was added — an entry
in `NotificationParamsByType`/`formattersHe`/`formattersEn`
(`apps/web/src/lib/i18n/dictionaries/notifications.ts`) plus a write site:

| Type | Audience | Trigger |
|---|---|---|
| `discovery_submitted` | owner | Customer completes all required sections and submits (parallels the existing `website_brief_received`, which stays untouched for backward compatibility with already-completed Website Briefs) |
| `discovery_information_requested` | customer | Staff reopens a section with a note (parallels `materials_missing`) |

`discovery_reminder` (nudge a customer who started but hasn't finished after N days) is
**template-defined but producer-not-wired**, exactly like the existing
`post_launch_follow_up` precedent — it requires a new `onSchedule` function, which is
explicitly out of scope for this pass (see `automation-events.md`'s own reasoning, which
applies identically here). No real WhatsApp/SMS/email is sent by this feature, matching
the entire existing journey system.

## 16. Backend Master Integration

Extends, does not duplicate, the existing `OnboardingJourneyPanel`
(`apps/web/src/components/onboarding-journey-panel.tsx`) on the staff per-project view
(`projects/view/page.tsx`) with a new "Discovery" card showing, per section: status
(not started / draft / completed), last activity, missing required fields, and actions
(open answers, reopen with a note, mark reviewed). Internal notes are a genuinely
separate collection (`discoveryNotes`, staff-write-only, never in any client-readable
rule) — not a field on a customer-visible document, so there is no risk of an internal
note leaking via a client Firestore listener. The existing org-wide `GET
/organizations/:organizationId/onboarding-overview` aggregation endpoint gains three more
computed fields (`discoveryStatus`, `discoveryPercent`, `discoverySubmittedAt`) rather
than a new endpoint, following the file's own established live-aggregation pattern (no
persisted rollup document to keep in sync). Full spec: `UX-FLOW.md` §6, `DATA-MODEL.md`
§2.5.

## 17. Roles and Permissions

No new role, no new permission concept. Every route uses the existing
`requireRole`/`requireProjectAccess`/`customerPermission` primitives from
`functions/src/auth.ts` verbatim:

| Action | Allowed roles |
|---|---|
| Read own project's Discovery | `client` (own project only, via `requireProjectAccess`), `owner/admin/operator/member` |
| Save/complete a section | `client` (own project), staff (for staff-assisted intake) |
| Reopen a section, add internal note | `owner/admin/operator` |
| Read internal notes | `owner/admin/operator` — never `client`, never a bare `member` |
| Submit Discovery (final) | `client` or staff |

Full RBAC matrix and the exact Firestore/Storage rule blocks: `SECURITY.md` §3–§5.

## 18. Firebase Architecture

No new Firebase project, no new Cloud Function trigger type, no new Hosting
configuration. New Discovery routes live in a new `functions/src/discovery-api.ts` router
mounted the same way `onboardingJourneyRouter` is (`app.use("/api", discoveryRouter)` in
`api.ts`/`index.ts`), sharing the same Express app, the same `authenticate` middleware,
the same rate-limit wiring, the same `nodejs22` runtime, the same `europe-west1` region.
Full diagram and integration points: `ARCHITECTURE.md`.

## 19. Firestore Schema

Full entity-by-entity specification (purpose, parent, fields, required fields,
timestamps, status enums, indexes, lifecycle): `DATA-MODEL.md`.

## 20. Storage Architecture

Path convention, size/type limits, and rule additions: §14 above and `SECURITY.md` §5.

## 21. Security Rules Requirements

Full rule text to add to `firestore.rules` and `storage.rules`, following the file's own
existing helper-function conventions exactly (including the `resource.data`-based
list-safe pattern required for any collection queried as a list, per the documented
Firestore rules-analyzer constraint): `SECURITY.md` §3–§5.

## 22. Authentication

No changes. Business Discovery is reached only by an already-authenticated `client`
member (via the existing `customerInvitations` → `members` doc claim flow) or staff.

## 23. Activity/Audit Model

Discovery events append to the existing organization-wide `activity` collection (the
same one every other router writes to — no new audit collection): `discovery_started`,
`discovery_section_completed` (not "every keystroke," per the mission's explicit
instruction), `discovery_submitted`, `discovery_section_reopened`,
`discovery_note_added`. See `SECURITY.md` §7 for the exact event shape and the
mandatory "never log full questionnaire content" constraint.

## 24. Questionnaire Versioning

`DISCOVERY_TEMPLATE_VERSION` (integer constant in `packages/core/src/discovery-template.
ts`), following the exact precedent of `documents.ts`'s `nextDocumentVersion()` helper.
Every `discoveryProgress/current` document records the `templateVersion` it was started
under; a project's answers always render against the template version they were
collected with, never the current one, so a 2027 template change cannot silently
reinterpret 2026 answers. New template versions never mutate old projects. Full
versioning/migration policy: `DATA-MODEL.md` §6.

## 25. AI-Ready Data Model

Every question definition carries a `semanticTag` drawn from a fixed enum (`
business_identity, business_story, ideal_customer, customer_trigger, pain_point,
desired_outcome, objection, differentiator, trust_signal, service, brand_style,
business_goal, cta_goal, automation_opportunity, business_capacity, ...`, full list in
`DATA-MODEL.md` §3.3). A `BusinessProfile` document type is defined
(`organizations/{orgId}/projects/{projectId}/businessProfile/current`) with every field
the mission's "Discovery Engine Output Model" lists, `status: "not_generated"` at launch,
and no generation code shipped — this is intentionally schema-only, per the mission's
explicit instruction not to build uncontrolled AI automation in this pass. Full schema:
`DATA-MODEL.md` §4.

## 26. Responsive/Mobile Behavior

No permanent sidebar on mobile Discovery — a compact "שלבים" (stages) control (bottom
sheet or condensed horizontal rail, matching the existing `CustomerJourneyTimeline`/
`WorkflowTimeline` rail pattern already used elsewhere in the portal) replaces any
desktop step list. Full spec: `UX-FLOW.md` §4.6.

## 27. PWA/Desktop Installation

**Already built and correct** — this is the single biggest "don't rebuild it" finding of
this audit. `apps/web/src/app/manifest.ts` produces a complete manifest (`name`,
`short_name`, all four icon sizes including maskable, `display: "standalone"`,
`start_url`, Hebrew `lang`/`dir`), `apps/web/public/sw.js` is registered in production
and installability-only by design, and all required icon assets already exist in
`apps/web/public/`. **Recommendation: keep the existing PWA approach; do not build
Electron** — there is no technical requirement Electron would satisfy that this static,
installable, standalone-display PWA does not already meet, and Electron would add an
entirely separate packaging/update/signing surface for no product benefit.

**One real, small gap found and worth fixing regardless of Discovery**: `manifest.ts`'s
`theme_color` (`#141512`) does not match `layout.tsx`'s `viewport.themeColor`
(`#101210`) — a one-line inconsistency, unrelated to Discovery, flagged here rather than
silently fixed since it touches shared shell files outside this subsystem's scope (see
§37).

**What the user needs to click to install** (Windows/Chrome, unchanged by this feature):
open the deployed PageLoom URL in Chrome or Edge → the address bar shows an install icon
(⊕ or a monitor-with-arrow icon) once the manifest/SW are served over HTTPS → click it →
"Install." No code change is required to enable this; it already works today against
`pageloom-os-production`.

## 28. Localization

Hebrew/RTL first, exactly matching `docs/ISRAEL-LOCALIZATION.md`'s existing contract
(customer sessions `lang="he" dir="rtl"`, logical CSS properties, no hardcoded English
in customer-facing copy). Discovery question copy follows the audit's recommended
pattern — a typed `Record<DiscoveryQuestionId, {label, whyWeAsk, helpText?, placeholder?}
>` dictionary per locale (`discoveryQuestions.ts`, mirroring `customerJourney.ts`'s
existing shape), registered in `apps/web/src/lib/i18n/index.ts`'s `dictionaries` map —
not the Website Brief's current approach of storing labels as Firestore data,
specifically so English becomes a real future option without a data migration (see
`DATA-MODEL.md` §3.2 for why this is a deliberate architecture change from the Website
Brief precedent, not an oversight).

## 29. Accessibility

Baseline WCAG-conscious requirements, consistent with what's already true of the
existing `product-ui.tsx` primitives (labeled inputs, `role="status"`/`role="progressbar"`
usage already present): every Discovery input has a visible, associated `<label>`;
keyboard-only completion of a full section is possible (`Tab`/`Shift+Tab`/`Enter`
progression, no mouse-only controls); focus moves to the first invalid field on a failed
section-complete attempt; color-pair and style-tile selectors are operable via keyboard
and expose their selected state to assistive tech (not color alone — an icon/checkmark
too); touch targets ≥44×44px on mobile; contrast meets AA against both light/dark theme
tokens already defined in `globals.css`.

## 30. Error States

All customer-facing errors render pre-written Hebrew copy from the i18n dictionary —
never a raw Firebase/server error string, matching the existing house rule already
enforced elsewhere (`portalQuestionnaire.ts`'s `s.fileUploadError`/`s.uploadError`
pattern):

| Condition | Customer-facing message (concept) |
|---|---|
| Autosave failed | "שומר… " → "שגיאה בשמירה — נסו שוב" with retry, answer preserved locally |
| Upload failed | "העלאת הקובץ נכשלה — נסו שוב" with retry, per-file |
| File too large / unsupported type | "הקובץ גדול/מסוג לא נתמך — עד 10MB, JPG/PNG/PDF" shown before upload attempt (client-side pre-check) |
| Network unavailable | Non-blocking banner; last-known-saved state stays visible, no fake "saved" claim |
| Session expired | Redirect to sign-in, return-to-Discovery deep link preserved |
| Permission denied (wrong project) | Generic "אין לכם גישה לפרויקט הזה" — no information disclosure about why |
| Section data could not load | Retry button + support contact, mirroring existing `Empty`/error patterns in `product-ui.tsx` |

## 31. Analytics

Event names only, no answer content (mandatory per §"Security & Privacy" and mission's
explicit instruction not to store questionnaire content in analytics):

`discovery_started, section_started, section_completed, discovery_resumed,
upload_started, upload_completed, upload_failed, discovery_submitted, support_opened`

Each event carries `organizationId`, `projectId`, `sectionId` where relevant, and a
timestamp — never `responses` content, never a raw answer string, never a file name if
the file name could contain personal data.

## 32. Testing

Full strategy: `TEST-PLAN.md`. Summary: unit tests for `isQuestionVisible`, progress
calculation, and template validation (Vitest, `packages/core`, matching
`workflow.test.ts`'s style); integration tests for the new Express router (matching
`onboarding-journey-api.ts`'s existing test coverage style); **behavioral** Firestore/
Storage rules tests added to the existing `firestore-rules.behavioral.test.ts`/
`storage-rules.behavioral.test.ts` suites (not new files — extending the existing
fixture-based emulator tests, per the audit's finding that the string-match-only layer
already shipped one real bug); cross-tenant rejection tests using the exact existing
fixture pattern (owner/staff/two-tier-client/disabled-member); autosave/resume/
conditional-question tests. All existing tests (`npm test`, `npm run test:behavioral`,
`npm run test:e2e`) must continue passing — CI's structure is unchanged (`TEST-PLAN.md`
§6).

## 33. Migration / Backward Compatibility

No data migration. In-flight projects that already have a Website Brief questionnaire
document keep it exactly as-is — the Website Brief mechanism (`createQuestionnaireSchema`,
`questionnaireFieldSchema`) is not removed, not deprecated in code, and not touched by
this feature. New projects (post-launch of this feature) get Business Discovery instead,
selected at the single existing trigger point
(`onboarding-journey-api.ts`'s payment-confirmation handler) by simply initializing
Discovery documents instead of auto-creating a Website Brief questionnaire there. Both
mechanisms independently satisfy the same `questionnaire` workflow stage's exit event
(`QuestionnaireCompleted`), so `WorkflowEngine`, `assets/validate`, and every downstream
stage need zero changes. Full rollout gating: `IMPLEMENTATION-PLAN.md` Phase 10.

## 34. Rollout Strategy

Local-first, phased, tests-gated, no CI deploy step added (CI remains test/build-only,
matching the existing repo convention with no exceptions). Every phase in
`IMPLEMENTATION-PLAN.md` ends in a state where `npm run check` passes. Production
deployment of any kind — Firestore rules, Storage rules, Functions, Hosting — requires
the fresh, current-turn, scope-specific approval defined in the repository's own
`CLAUDE.md` production-safety gate; this PRD does not and cannot pre-authorize any of it.

## 35. Risks

| Risk | Mitigation |
|---|---|
| Two parallel intake mechanisms (Website Brief + Discovery) increase long-term maintenance surface | Explicitly accepted trade-off per "no data migration" (§33); revisit deprecating the Website Brief path only after Discovery has run in production for a full cohort of projects |
| Code-defined (not Firestore-editable) template limits agility if questions need to change often | Versioning (§24) makes shipping a new template version a normal code change with zero blast radius on existing projects; a Firestore-editable template builder remains a valid v2 if question churn turns out to be frequent (§37) |
| Conditional-logic bugs could incorrectly mark a section complete despite a "hidden-but-actually-required" question | Single shared `isQuestionVisible` function used both client and server-side (§11) — no duplicate logic path to diverge |
| Upload UX gap (no progress %, no preview) is bigger than Discovery alone — could be perceived as a Discovery bug when it's a pre-existing gap | Explicitly scoped and fixed as part of Phase 5 rather than left implicit (§14) |
| Notification type sync between backend writers and `notifications.ts` is currently convention-only, not type-checked (audit finding) | Not fixed by this feature (out of scope — a separate cross-cutting improvement); flagged here so it isn't mistaken for new tech debt introduced by Discovery |

## 36. Open Questions

Decisions that need a PageLoom product call before or during implementation — see §37 for
the full list with recommendations. The one that most changes scope: **should the
Website Brief questionnaire be deprecated/removed once Discovery ships**, or kept
indefinitely as a staff tool for ad-hoc custom questionnaires (its generic
`createQuestionnaireSchema` mechanism is still useful for one-off staff-created forms
unrelated to Discovery)? This PRD assumes "keep it as a generic staff tool, stop
auto-creating it at payment confirmation" — see §37.

## 37. Definition of Done

Business Discovery is done when: every section listed in `UX-FLOW.md` §5 is reachable,
autosaves, and validates correctly; a submitted Discovery correctly emits
`QuestionnaireCompleted` and advances the project exactly as the Website Brief does
today; Backend Master shows accurate per-section status with working reopen/note
actions and internal notes are provably invisible to `client` role (rules test, not just
UI hiding); all new Firestore/Storage rules pass the existing behavioral emulator test
suite; `npm run check` passes; and no production-affecting command has run without the
fresh explicit approval `CLAUDE.md` requires.

---

## Open Decisions Requiring a Product Call

These are flagged, not resolved, per the mission's explicit instruction to stop and ask
rather than invent business/legal answers.

1. **Website Brief's future**: deprecate entirely, keep as a staff-only generic
   questionnaire tool (this PRD's assumption), or run both simultaneously per-project
   type indefinitely? Affects `onboarding-journey-api.ts`'s trigger logic scope in Phase 1.
2. **Template editability**: code-defined + versioned (this PRD's recommendation, matches
   `website-content.ts`/`website-brief.ts` precedent) vs. a Firestore-backed template
   builder PageLoom staff can edit without a deploy. The latter is a materially larger
   build (a template CRUD UI, draft/publish states for templates themselves, migration
   tooling) — recommend deferring until question churn in practice justifies it.
3. **AI synthesis timing**: this PRD defines `BusinessProfile`'s schema but explicitly
   does not build the generation step. When PageLoom is ready to approve it, it needs its
   own scoped mission (model/provider choice, cost, prompt design, approval gate) — not
   silently added here.
4. **Discovery reminder scheduling**: needs a new `onSchedule` function (like
   `post_launch_follow_up`) — deferred pending a decision on cadence and whether
   automated nudges are wanted at all before a human ever contacts the customer.
5. **`manifest.ts`/`layout.tsx` theme-color mismatch** (§27): trivial one-line fix,
   unrelated to Discovery — flagged for a separate, explicitly-scoped fix rather than
   bundled into this feature's diff.
