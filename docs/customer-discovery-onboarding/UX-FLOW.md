# Business Discovery — UX Flow

Companion to [`PRD.md`](./PRD.md). Visual conventions reuse existing components; see
`ARCHITECTURE.md` §2 for exact file locations.

## 1. Textual flow diagram

```
Invitation (existing customerInvitations → members claim flow, unchanged)
  ↓
Sign In (existing Firebase Auth, unchanged)
  ↓
Project Dashboard / Customer Portal (apps/web/.../portal/page.tsx)
  ↓
Task card: "אנחנו צריכים להכיר את העסק שלכם" → CTA "התחילו את אפיון העסק"
  ↓
Discovery shell opens — Stage 1: היכרות עם העסק
  ↓ (autosave on every field, "Next" moves forward, "Previous" moves back)
Stage 2: הלקוחות שלכם
  ↓
Stage 3: השירותים שלכם
  ↓
Stage 4: למה בוחרים בכם
  ↓
Stage 5: אמון והמלצות
  ↓
Stage 6: מיתוג וסגנון
  ↓
Stage 7: חומרים ותמונות
  ↓
Stage 8: פרטי העסק והנוכחות הדיגיטלית
  ↓
Stage 9: המטרה והסיום
  ↓
Review screen (per-section summary, "ערכו" edit links back into any section)
  ↓
Submit
  ↓
Discovery Complete screen 🎉
  ↓
Backend Master Review (staff sees per-section status, can reopen)
  ↓
Missing Information? ──Yes──> Reopen a section (staff, with a reason)
  │                              ↓
  │                            Customer sees "דרוש מידע נוסף" banner + reason,
  │                              re-edits that section, resubmits
  │                              ↓
  │                            back to "Backend Master Review"
  └──No
  ↓
Marked "reviewed" (staff, visibility only — does not itself gate anything)
  ↓
Existing `assets/validate` flow (staff confirms build materials — unchanged endpoint,
  see ARCHITECTURE.md §4) → workflow advances assets → research
  ↓
Rest of the existing project lifecycle (unchanged — docs/customer-journey/FLOW.md)
```

## 2. Screen inventory

### Customer-facing

| Screen | State(s) | Notes |
|---|---|---|
| Dashboard task card | not started / in progress (%) / submitted / needs more info | Replaces/extends the existing `WelcomePanel` CTA target |
| Discovery shell — stepper | 9 steps, current/completed/upcoming | Reuses the rail visual pattern from `CustomerJourneyTimeline`/`WorkflowTimeline` |
| Section screen ×9 | loading / ready / saving / saved / save-error / validation-error | One component, data-driven by `discoveryTemplate` |
| "Why we ask" popover | collapsed (default) / expanded | Per-question, never a permanent panel |
| File upload control | idle / uploading (% progress) / uploaded (thumbnail or filename) / failed (retry) | New shared component — see `PRD.md` §14 |
| Resume-later re-entry | mid-flow, any device | Driven entirely by Firestore state — no separate "resume" screen needed |
| Review screen | pre-submit | Per-section summary + edit links; shows nothing for hidden (conditionally-skipped) questions |
| Discovery Complete | post-submit | 🎉 completion copy, CTA "חזרה למרכז הפרויקט" |
| "Needs more info" banner | after staff reopen | Shows the staff-entered `reopenReason`, links directly into the reopened section |
| Notifications inbox | existing component | Gains `discovery_submitted`/`discovery_information_requested` formatting entries |

### Master Panel / staff

| Screen | State(s) | Notes |
|---|---|---|
| Discovery panel (project view, onboarding tab) | per-section status grid | Extends `OnboardingJourneyPanel`, does not replace its materials/revisions/handover cards |
| Section detail (staff read) | — | Read-only view of a customer's answers, including hidden/conditionally-skipped questions marked as "not applicable" rather than "missing" |
| Reopen dialog | — | Requires a reason (free text), staff role only |
| Internal notes thread | — | Per-section or Discovery-wide, staff-only, never customer-visible |
| Org-wide onboarding overview (existing table) | — | Gains `discoveryStatus`/`discoveryPercent`/`discoverySubmittedAt` columns |

## 3. Dashboard task card — states

```
not_started:   "אנחנו צריכים להכיר את העסק שלכם" / CTA "התחילו את אפיון העסק"
in_progress:   "ממשיכים את אפיון העסק (X מתוך 9 שלבים הושלמו)" / CTA "המשיכו"
submitted:     "אפיון העסק נשלח — אנחנו בודקים את הפרטים" / no CTA, status only
reopened:      "דרוש מידע נוסף בשלב X" / CTA "השלימו את הפרטים החסרים" (highlighted)
reviewed:      folded into the existing project-stage task card once assets/build starts
```

## 4. Discovery section screen — interaction spec

### 4.1 Layout (desktop)

- Top: compact stepper (9 dots/segments, current highlighted, matching the existing rail
  pattern — not a new visual language).
- "שלב X מתוך 9" + section title + percent complete, matching the mission's exact
  example format.
- 3–6 questions, one visual group, generous spacing (mission requirement: "large answer
  areas").
- Bottom: "הקודם" (previous, disabled on stage 1) · save-status word · "הבא" (next).

### 4.2 Save-status states (exact Hebrew, per `PRD.md` §12)

`שומר…` → `נשמר` (with a small "לפני רגע"/relative-time note) → `שגיאה בשמירה — נסו שוב`
(persistent until retried successfully).

### 4.3 "Why we ask" pattern

```
[question label]                                    ⓘ למה אנחנו שואלים?
[input]
```
Clicking the ⓘ expands a one-paragraph explanation inline (no modal, no permanent
panel), collapses again on second click. Copy source: `discoveryQuestions.ts`'s
`whyWeAsk` field, per question.

### 4.4 Conditional questions

A question with an unmet `visibleIf` never renders — no disabled/greyed-out state, no
layout gap. This means the visible question count on a section can differ per customer
(e.g. "no existing website" skips 2-3 questions in stage 8) — the stepper's percent
math (`DATA-MODEL.md` §2.2) is based on section completion, not question count, so this
never produces a confusing "your progress went backward" moment.

### 4.5 File upload UX

- Drag-or-tap target, large touch area (mobile requirement).
- On select: client-side pre-check (size/type) before any network call — see `PRD.md`
  §30's error-state table for the exact rejection message.
- Upload progress: a real percentage bar (`uploadBytesResumable`, replacing the
  non-resumable `uploadBytes` used elsewhere in the app today — see `PRD.md` §14 for why
  this is scoped as a deliberate, contained upgrade for this feature only).
- On success: a thumbnail for images (first real image preview in this codebase — audit
  found zero existing `getDownloadURL` call sites), or a filename+icon for non-image
  files (PDF, zip).
- Replace / remove: tapping an uploaded item's "✕" removes it from the response array
  (does not delete the underlying Storage object immediately — soft removal, matching
  the platform-wide no-casual-hard-delete posture in `SECURITY.md` §8; the object is
  simply no longer referenced).
- Retry: a failed upload shows a retry button inline, re-attempting the same file without
  requiring re-selection.

### 4.6 Mobile behavior

- No permanent sidebar — the 9-step stepper collapses to a compact horizontal
  `overflow-x-auto` rail (same pattern already used by `CustomerJourneyTimeline` on
  narrow viewports) or a "שלבים ▾" dropdown sheet, whichever the existing rail pattern's
  mobile behavior already resolves to (reuse, don't reinvent).
- Full-width, single-column inputs (matching the existing `.input{width:100%}` global
  rule).
- Touch targets ≥44×44px (mission + accessibility requirement, `PRD.md` §29).
- Next/Previous buttons pinned to the bottom of the viewport, not requiring a scroll to
  find on a long section.

## 5. Per-stage question list

Question ids are illustrative and authoritative for `discovery-template.ts` — exact
Hebrew copy lives in `discoveryQuestions.ts`, not here.

### Stage 1 — היכרות עם העסק (`business`)
`business.publicName` (short_text, req, `business_identity`) · `business.whatItDoes`
(long_text, req, `business_identity`) · `business.story` (long_text, opt,
`business_story`) · `business.founderPriorities` (long_text, opt, `business_story`) ·
`business.customerFeeling` (long_text, req, `business_identity`)

No headline/subheadline/CTA copy field — deliberately absent per `PRD.md` §10 and the
mission's core rule.

### Stage 2 — הלקוחות שלכם (`customers`)
`customers.idealCustomer` (long_text, req, `ideal_customer`) · `customers.beforeContact`
(long_text, req, `customer_trigger`) · `customers.realProblem` (long_text, req,
`pain_point`) · `customers.desiredOutcome` (long_text, req, `desired_outcome`) ·
`customers.commonFears` (long_text, opt, `objection`) · `customers.ifUnsolved`
(long_text, opt, `pain_point`)

### Stage 3 — השירותים שלכם (`services`)
`services.list` (service_repeater, req, `service`, min 1, max 20 — no artificial 6-item
cap per mission's explicit instruction)

### Stage 4 — למה בוחרים בכם (`differentiation`)
`differentiation.whyCustomersChoseYou` (long_text, req, `differentiator`) ·
`differentiation.whatCustomersSay` (long_text, opt, `proof_signal`) ·
`differentiation.processAdvantages` (multi_select — availability/speed/personal service/
methodology/guarantees/transparency/after-service/expertise/certifications, req,
`differentiator`) · `differentiation.other` (long_text, opt, `differentiator`)

### Stage 5 — אמון והמלצות (`trust`)
`trust.hasTestimonials` (boolean, req, `proof_signal`) · `trust.testimonials`
(testimonial_repeater, visibleIf hasTestimonials=true, `proof_signal`, max 10) ·
`trust.wantsHelpCollecting` (boolean, visibleIf hasTestimonials=false, `proof_signal`) ·
`trust.yearsExperience` (short_text, opt, `proof_signal`) · `trust.clientCount`
(short_text, opt, `proof_signal`) · `trust.certifications` (long_text, opt,
`proof_signal`)

### Stage 6 — מיתוג וסגנון (`branding`)
`branding.hasLogo` (boolean, req, `brand_style`) · `branding.logo` (file, visibleIf
hasLogo=true, `brand_style`) · `branding.colors` (color_pair, req, `brand_color` — max
two colors, visual swatch selector per mission, options: blue/black/white/green/gold/
beige/grey/custom) · `branding.style` (multi_select — modern/premium/clean-minimal/
warm-friendly/young-dynamic/professional/innovative/calm, req, `brand_style`) ·
`branding.avoid` (long_text, opt, `brand_style`)

### Stage 7 — חומרים ותמונות (`materials`)
`materials.ownerPhotos` (file_repeater, opt, `proof_signal`, max 5) ·
`materials.teamPhotos` (file_repeater, opt, `proof_signal`, max 5) ·
`materials.locationPhotos` (file_repeater, opt, `proof_signal`, max 5) ·
`materials.productPhotos` (file_repeater, opt, `proof_signal`, max 10) ·
`materials.priceListOrBrochure` (file_repeater, opt, `service`, max 3)

### Stage 8 — פרטי העסק והנוכחות הדיגיטלית (`presence`)
`presence.phone` (phone, req, `contact_channel`) · `presence.whatsapp` (phone, opt,
`contact_channel`) · `presence.email` (email, req, `contact_channel`) ·
`presence.address` (address, opt, `contact_channel`) · `presence.hours` (short_text,
opt, `contact_channel`) · `presence.serviceAreas` (long_text, opt, `contact_channel`) ·
`presence.hasWebsite` (boolean, req, `acquisition_channel`) · `presence.existingWebsiteUrl`
(url, visibleIf hasWebsite=true) · `presence.hasDomain` (boolean, req,
`acquisition_channel`) · `presence.socialLinks` (social_links, opt,
`acquisition_channel`) · `presence.googleBusinessUrl` (url, opt, `acquisition_channel`)

### Stage 9 — המטרה והסיום (`goals`)
`goals.biggestProblem` (long_text, req, `business_goal`) · `goals.sixMonthSuccess`
(long_text, req, `kpi`) · `goals.priorityOutcomes` (multi_select — more inquiries/better
leads/more customers/more sales/more trust/better Google visibility/easier bookings/less
manual work/better follow-up/better digital presence, req, `business_goal`) ·
`goals.capacityCheck` (long_text, req, `business_capacity` — "אם תקבלו פי שלושה פניות
מחר, תוכלו לטפל בהן?")

## 6. Backend Master — Discovery panel layout

Extends `OnboardingJourneyPanel`'s existing card-based layout (`materials`,
`revisions`, `launch checklist`, `handover` cards already there) with one more card,
**Discovery**, positioned first (it's the earliest-lifecycle concern):

```
┌ Discovery ──────────────────────────────────────────────┐
│ Status: הוגש · 9/9 שלבים הושלמו · הוגש לפני 2 ימים        │
│                                                            │
│ 1. היכרות עם העסק        ✓ הושלם                          │
│ 2. הלקוחות שלכם          ✓ הושלם          [פתחו מחדש]     │
│ 3. השירותים שלכם         ✓ הושלם                          │
│ ...                                                        │
│ 9. המטרה והסיום          ✓ הושלם                          │
│                                                            │
│ [סמנו כנבדק]     [הצגת תשובות מלאה]     [הוספת הערה פנימית]│
└────────────────────────────────────────────────────────────┘
```

Per-section "פתחו מחדש" (reopen) opens the reopen dialog requiring a reason. "הצגת
תשובות מלאה" opens a read-only full-answer view (staff only, includes conditionally
hidden questions marked "לא רלוונטי" rather than omitted, so staff can tell "skipped by
logic" apart from "left blank"). Internal notes render below, timestamped, attributed,
append-only — no edit/delete control, matching `SECURITY.md` §3.3's immutability
guarantee.
