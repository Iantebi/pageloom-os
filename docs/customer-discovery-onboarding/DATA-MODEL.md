# Business Discovery — Data Model

Companion to [`PRD.md`](./PRD.md). This is the authoritative schema reference; the PRD
only summarizes it.

## 1. Design principles carried over from the existing codebase

- **Tenant scoping**: everything lives under `organizations/{orgId}/projects/{projectId}/
  ...`, exactly like `revisionRequests`, `launchChecklist`, `handover`, `questionnaires`.
- **Singleton-doc-for-current-state, subcollection-for-history**: the same idiom used by
  `launchChecklist/current`, `handover/current`, and `websites/{id}/content/draft|
  published` — a mutable "current" doc plus, where history matters, an append-only
  subcollection (mirrors `contentRevisions`).
- **Server-authorized writes only**: Firestore rules stay `allow write: if false`
  everywhere for these collections, exactly like every existing collection. All writes go
  through `functions/src/discovery-api.ts` using the Admin SDK.
- **Code-defined template, not customer/staff-editable in v1**: mirrors
  `website-content.ts`'s `websiteContentSections`/`websiteContentFields` and
  `website-brief.ts`'s `websiteBriefFields` — both existing precedents are fixed,
  code-defined arrays "to keep validation, permissions, and sanitization tractable" (the
  `website-content.ts` file's own words). Business Discovery's question set follows the
  same reasoning. See `PRD.md` §37, open decision 2, for the versioned-editable-template
  alternative.

## 2. Firestore collections

```
organizations/{orgId}/projects/{projectId}/
  discovery/{sectionId}                 — one doc per section (9 fixed ids)
  discoveryProgress/current             — singleton rollup
  discoveryNotes/{noteId}                — append-only, staff-only, internal
  businessProfile/current                — schema-only in v1, see §4
```

### 2.1 `discovery/{sectionId}`

`sectionId` is one of the 9 fixed `DiscoverySectionId` values (§3.1) — not an
auto-generated id, so a section document's existence is itself meaningful (created lazily
on first write, per §2.4).

```ts
interface DiscoverySectionDocument {
  id: DiscoverySectionId;
  projectId: string;
  templateVersion: number;                 // DISCOVERY_TEMPLATE_VERSION at creation time
  status: "draft" | "completed";
  responses: DiscoveryResponses;           // see §3.5
  updatedAt: string;                       // ISO, server timestamp
  updatedBy: string;                       // uid, customer or staff
  completedAt?: string;
  completedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;                   // short staff-entered reason, shown to customer
}
```

Required fields: `id`, `projectId`, `templateVersion`, `status`, `responses`,
`updatedAt`, `updatedBy`. `responses` defaults to `{}` on lazy creation.

**Status enum** (deliberately just two states per document, not the six the mission
lists — those six are the *Discovery-level* lifecycle, tracked on `discoveryProgress`
instead, per §2.2, to avoid ambiguity about which document is authoritative for what):
`draft → completed`, and `completed → draft` only via staff reopen (which also stamps
`reopenedAt`/`reopenedBy`/`reopenReason` without clearing `responses` — reopening
never discards previously entered answers).

### 2.2 `discoveryProgress/current`

The Discovery-level state machine lives here, separate from individual sections, so
there is one unambiguous place that answers "where is this project's Discovery right
now":

```ts
interface DiscoveryProgressDocument {
  id: "current";
  projectId: string;
  templateVersion: number;                 // frozen at first section write, never bumped
  status: "not_started" | "in_progress" | "submitted" | "reviewed" | "reopened";
  startedAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  currentSectionId?: DiscoverySectionId;    // last section the customer was on
  completedSectionIds: DiscoverySectionId[]; // only sections marked complete, §PRD §13
  percentComplete: number;                  // completedSectionIds.length / 9 * 100
  lastActivityAt: string;
}
```

**Status transitions** (server-enforced in `discovery-api.ts`, not client-trusted):

```
not_started --(first section write)--> in_progress
in_progress --(POST /discovery/submit, all required sections complete)--> submitted
submitted --(staff marks reviewed)--> reviewed
submitted|reviewed --(staff reopens any section)--> reopened
reopened --(customer completes the reopened section + resubmits)--> submitted
```

`reviewed` is purely a staff visibility/readiness flag (mirrors `launchChecklist`'s
"purely a visibility aid, does not itself authorize anything" pattern) — it does not
gate `assets` stage advancement; `submitted` is what emits `QuestionnaireCompleted` (see
`ARCHITECTURE.md` §3 for the exact integration point).

### 2.3 `discoveryNotes/{noteId}`

```ts
interface DiscoveryNoteDocument {
  id: string;
  projectId: string;
  sectionId?: DiscoverySectionId;   // omitted for a Discovery-wide note
  authorId: string;
  authorName: string;               // denormalized for display without a join
  body: string;                     // max 2000 chars
  createdAt: string;
}
```

Append-only (no edit/delete endpoint — matches `revisionRequests`'/`contentRevisions`'
immutable-history idiom). **Never** exposed by any rule readable by `client` — see
`SECURITY.md` §3.3. This is the mechanism that satisfies the mission's hard requirement
"customer must never see internal notes": by being a wholly separate collection with its
own rule, not a field on a shared document, there is no risk of it leaking through a
field-level oversight on the customer-visible `discovery/{sectionId}` documents.

### 2.4 Lazy creation, not eager scaffolding

No Cloud Function pre-creates all 9 `discovery/{sectionId}` documents when Discovery
starts. Each section document is created on the section's **first autosave** (`PATCH
.../discovery/sections/:sectionId`, upsert semantics). `discoveryProgress/current` is
created (or transitioned to `in_progress`) at the same moment if it doesn't exist yet.
This avoids 9 speculative writes for a customer who starts Discovery and never returns
past section 1 — consistent with the mission's "avoid excessive Firestore writes"
constraint — while still letting a `GET /discovery` read return "not started" section
placeholders computed from the template, not from Firestore, for sections that don't
exist yet.

## 3. Discovery template (`packages/core/src/discovery-template.ts`, new file)

### 3.1 Section ids

```ts
export const DISCOVERY_TEMPLATE_VERSION = 1;

export type DiscoverySectionId =
  | "business"        // 1. היכרות עם העסק
  | "customers"        // 2. הלקוחות שלכם
  | "services"         // 3. השירותים שלכם
  | "differentiation"   // 4. למה בוחרים בכם
  | "trust"             // 5. אמון והמלצות
  | "branding"          // 6. מיתוג וסגנון
  | "materials"         // 7. חומרים ותמונות
  | "presence"          // 8. פרטי העסק והנוכחות הדיגיטלית
  | "goals";            // 9. המטרה והסיום

export const discoverySectionOrder: DiscoverySectionId[] = [
  "business", "customers", "services", "differentiation", "trust",
  "branding", "materials", "presence", "goals",
];
```

### 3.2 Question definition (code-defined; copy lives in i18n, not here)

```ts
export type DiscoveryFieldType =
  | "short_text" | "long_text" | "email" | "phone" | "url" | "select" | "multi_select"
  | "boolean" | "date" | "color_pair" | "file" | "file_repeater"
  | "service_repeater" | "testimonial_repeater" | "address" | "social_links";

export interface DiscoveryCondition {
  questionId: string;
  equals?: string | boolean;
  notEmpty?: boolean;
}

export interface DiscoveryQuestion {
  id: string;                         // stable, never reused across template versions
  sectionId: DiscoverySectionId;
  type: DiscoveryFieldType;
  required: boolean;
  semanticTag: SemanticTag;           // §3.3
  visibleIf?: DiscoveryCondition[];   // AND semantics; absent = always visible
  options?: string[];                 // select / multi_select
  minItems?: number;                  // repeaters
  maxItems?: number;                  // repeaters
  maxLength?: number;                 // text types
}

export interface DiscoverySectionDefinition {
  id: DiscoverySectionId;
  order: number;
  questions: DiscoveryQuestion[];
}

export const discoveryTemplate: DiscoverySectionDefinition[] = [ /* ... */ ];
```

Deliberately **no `label`/`helpText`/`whyWeAsk` field here** — those live in
`apps/web/src/lib/i18n/dictionaries/discoveryQuestions.ts` as a
`Record<string, { label, whyWeAsk, helpText?, placeholder? }>` per locale, following the
audit's recommended pattern (matching `customerJourney.ts`'s `Record<BucketId,
BucketCopy>` shape) rather than the Website Brief's approach of storing labels as
Firestore-editable data. This is a deliberate split: **structure and validation are
code** (this file), **copy is i18n** (the dictionary) — so a future English rollout
touches zero validation logic, only the dictionary.

### 3.3 Semantic tags (AI-ready, unused by any code path in this release)

```ts
export type SemanticTag =
  | "business_identity" | "business_story" | "ideal_customer" | "customer_trigger"
  | "pain_point" | "desired_outcome" | "emotional_motivation" | "buying_motivation"
  | "objection" | "trust_barrier" | "differentiator" | "service" | "priority_service"
  | "proof_signal" | "brand_style" | "brand_color" | "acquisition_channel"
  | "business_goal" | "kpi" | "business_capacity" | "cta_goal"
  | "automation_opportunity" | "contact_channel";
```

Every question in `discoveryTemplate` must have exactly one `semanticTag` — enforced by
the TypeScript type (no `?`), not a runtime check, so a missing tag is a compile error.

### 3.4 Conditional rules shipped at launch (mission's own examples)

| Question hidden | `visibleIf` |
|---|---|
| Existing-website detail questions | `[{questionId:"presence.hasWebsite", equals:true}]` |
| Domain-configuration questions | `[{questionId:"presence.hasDomain", equals:true}]` |
| "Upload your testimonials" prompt | `[{questionId:"trust.hasTestimonials", equals:true}]` |
| "Can PageLoom help collect testimonials?" | `[{questionId:"trust.hasTestimonials", equals:false}]` |
| "Upload your logo" | shown always; a `false` answer to `branding.hasLogo` instead sets an internal flag consumed by staff view (`needsBrandingHelp`), not a hidden question — mirrors "mark branding/logo assistance as needed" without deleting the upload option itself |

Evaluation function (single source of truth, `packages/core/src/discovery-template.ts`):

```ts
export function isQuestionVisible(
  question: DiscoveryQuestion,
  responses: DiscoveryResponses,
): boolean {
  if (!question.visibleIf?.length) return true;
  return question.visibleIf.every((cond) => {
    const value = responses[cond.questionId];
    if (cond.equals !== undefined) return value === cond.equals;
    if (cond.notEmpty) return value !== undefined && value !== "" &&
      !(Array.isArray(value) && value.length === 0);
    return true;
  });
}
```

Used identically by the client (render) and `discovery-api.ts` (required-field
validation on section-complete) — see `PRD.md` §11.

### 3.5 Response value shapes

```ts
export type DiscoveryResponseValue =
  | string | boolean
  | string[]                                              // multi_select, social_links (as list of urls per platform, see below)
  | { uploadedAt: string; path: string; fileName: string; sizeBytes: number; source: "customer" | "ai_generated" }[]   // file / file_repeater
  | { name: string; forWhom: string; problem: string; outcome: string; priceLabel?: string; promote: boolean }[]       // service_repeater
  | { text: string; author?: string; source?: "written" | "google" | "whatsapp" | "screenshot" }[]                      // testimonial_repeater
  | { line1: string; city: string; serviceAreas?: string[] }                                                            // address
  | [string, string?];                                                                                                  // color_pair, 1-2 hex values

export type DiscoveryResponses = Record<string, DiscoveryResponseValue>;
```

`file`/`file_repeater` responses carry `source` now (§`PRD.md` §14) so a future
AI-sourced-image workflow needs no schema change — only a new writer.

### 3.6 Required-field validation (server-side, mirrors `missingRequiredQuestionnaireFields`)

```ts
export function missingRequiredDiscoveryFields(
  section: DiscoverySectionDefinition,
  responses: DiscoveryResponses,
): string[] {
  return section.questions
    .filter((q) => q.required && isQuestionVisible(q, responses))
    .filter((q) => isEmptyResponse(q.type, responses[q.id]))
    .map((q) => q.id);
}
```

Directly extends the existing `client-management.ts` helper's shape and naming
convention rather than inventing a different validation vocabulary.

## 4. `businessProfile/current` — schema only, not generated in this release

Per `PRD.md` §25 and §37 (open decision 3): defined now so a future AI synthesis step has
a stable contract to write into; **no code path writes to this document in this
release**.

```ts
interface BusinessProfileDocument {
  id: "current";
  projectId: string;
  status: "not_generated";           // only value used until AI synthesis ships
  schemaVersion: 1;
  // Every field below is optional and unpopulated at launch.
  businessProfile?: string;
  idealCustomer?: string;
  customerTrigger?: string;
  primaryPainPoints?: string[];
  secondaryPainPoints?: string[];
  desiredOutcomes?: string[];
  emotionalMotivations?: string[];
  buyingMotivations?: string[];
  commonObjections?: string[];
  trustBarriers?: string[];
  valueProposition?: string;
  differentiators?: string[];
  services?: { name: string; priority: boolean }[];
  priorityService?: string;
  proofSignals?: string[];
  currentAcquisitionChannels?: string[];
  customerJourney?: string;
  leadDropOffPoints?: string[];
  followUpProblems?: string[];
  automationOpportunities?: string[];
  primaryBusinessGoal?: string;
  kpis?: string[];
  businessCapacity?: string;
  recommendedCta?: string;
  recommendedPageStructure?: string[];
  recommendedContent?: string[];
  recommendedFaq?: { question: string; answer: string }[];
  recommendedSeoTopics?: string[];
  recommendedImages?: string[];
  recommendedAutomations?: string[];
  recommendedFutureImprovements?: string[];
  generatedAt?: string;
  generatedFromTemplateVersion?: number;
}
```

## 5. Indexes

`GET /projects/:id/discovery` reads a fixed set of ≤9 section docs by known id — no
query, no index needed. The one place a new composite index is plausible is the
org-wide onboarding-overview extension (`PRD.md` §16) if it starts filtering/sorting
projects by `discoveryProgress.status` server-side rather than computing it live per
project as the endpoint already does today; **not needed at launch** since the endpoint's
existing live-aggregation pattern (no persisted rollup query) is being extended, not
replaced. Revisit only if that endpoint's per-request read volume becomes a measured
problem.

## 6. Versioning & migration policy

- `DISCOVERY_TEMPLATE_VERSION` bumps only when a **breaking** change is made to
  `discoveryTemplate` (a required question added, a question's `type` changed, a
  question removed that existing data references). Adding a new *optional* question, or
  editing copy in the i18n dictionary, does not require a version bump.
- A project's `discoveryProgress.templateVersion` is frozen at first write and never
  advanced automatically. The UI resolves which template version's *structure* to render
  by reading this field, not the current `DISCOVERY_TEMPLATE_VERSION` constant — so an
  in-progress Discovery never has its question set silently change under the customer
  mid-flow, and a completed Discovery always displays exactly the questions it was
  answered against.
- No migration script moves old-version data to new-version shape. If a future template
  version needs to reinterpret old answers, that reinterpretation happens in the (not yet
  built) AI synthesis step, which can read `templateVersion` and branch — not in the
  Discovery data layer itself.
