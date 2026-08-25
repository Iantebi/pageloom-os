# Sprint Zeta — Business assets, customer experience and operational excellence

Owner: Business/CX/Sales/Ops review · Input state: business readiness 94%, Conditional GO, per `SPRINT-EPSILON-BUSINESS-READINESS.md` (see breakdown below) · No code, pricing, or legal text was authored in this sprint.

This sprint picks up after Alpha (enterprise foundation), Beta (Israel/Hebrew localization), Gamma (business hardening + launch audit), Delta (company operating system) and the three Epsilon reports (customer experience, owner experience, business readiness). Where those sprints already closed an item, this report cross-references rather than repeats it. Findings below are grounded in the current portal source (`apps/web/src`), the versioned document engine (`packages/core/src/documents.ts`), the existing Hebrew message templates (`packages/core/src/israel-localization.ts`), `docs/company/*`, `docs/SUPPORT-PLAYBOOK.md`, `docs/BUSINESS-OPERATIONS.md`, `docs/LAUNCH-BOARD.md`, and `workflows/customer-journey.v1.json` — not invented.

**Current authoritative readiness figure:** `SPRINT-EPSILON-BUSINESS-READINESS.md` — the most recent business-readiness report — states **94%, Conditional GO**, with per-area scores (customer workflow 96%, portal/Hebrew UX 94%, documents 92%, owner operations 94%, security 95%, support/delivery 92%, legal/commercial 76%) and four remaining external gates: legal (owner+counsel), finance (owner+accountant), support (owner approves channel/hours), deployment (owner approves each release). Earlier snapshots from the same sprint arc (88% in Gamma, 89–92% in the company Launch Readiness note) are superseded by this figure — this report uses 94% throughout and does not re-litigate the four owner-gated blockers, which no content work can close.

**Existing communication template inventory (do not recreate):** `israel-localization.ts` already ships five owner-approval-gated Hebrew draft templates, each with an email subject+body and a shorter WhatsApp variant, in a consistent voice ("שלום {name}," warm/concise/professional, signed "צוות PageLoom"): `onboarding_started`, `questionnaire_ready`, `approval_required` (final website approval, not an earlier design checkpoint), `revision_received`, `website_published`. Per `ISRAEL-LOCALIZATION.md`: "Template rendering does not send a message. Existing authorization policy still requires owner approval before any external email or WhatsApp transmission." The library added in this sprint (`CUSTOMER-COMMUNICATION-LIBRARY.md`) fills the remaining touchpoints in the identical format and voice, and is explicitly marked draft/pending-approval — it does not duplicate these five.

---

## Phase 1 — Customer journey audit

The system already models 13 stages (`workflows/customer-journey.v1.json`) and the operations manual documents 16 workflows end to end. Mapped against the requested lifecycle:

| Stage | System owner | Automated? | Friction / gap found | Recommendation |
|---|---|---|---|---|
| Lead | sales | No (`customerAiInteraction: false`, "no AI selling") | No lead follow-up message exists yet (confirmed absent from `israel-localization.ts`) — sales currently improvises the first reply. | Adopt the Lead follow-up templates in `CUSTOMER-COMMUNICATION-LIBRARY.md`. |
| Discovery (sales call) | owner | No | Operations manual requires recording "goals, budget range, authority, timeline and constraints" but there is no discovery-call script or question checklist for the founder to work from. Sprint Epsilon Owner Experience separately notes no discrete `ProposalDelivered` event exists yet, so proposal-stage timing can't be isolated from the lead stage. | Add a one-page discovery call guide (Phase 4); the missing event is a data-model note for engineering, not fixed here. |
| Proposal | owner | Semi (document engine renders it) | Proposal is owner-approved and send-gated (correct), but no candidate proposal cover-message exists for the human sending it — this touchpoint is genuinely new, not covered by the five existing templates. | Add Proposal delivery templates (email/WhatsApp). |
| Contract | owner + counsel | No | **Legal is the #1 blocker to Customer #1** — Hebrew agreement/privacy/accessibility/terms/DPA/e-signature-consent text is not yet counsel-approved (`SPRINT-EPSILON-BUSINESS-READINESS.md`, blocker 1 of 4). This is a legal decision, not a content gap; flagged again in Phase 8. | No sprint work can close this — owner + counsel action required. |
| Questionnaire | client-journey (automated) | Yes | Portal questionnaire (`apps/web/src/app/(product)/portal/page.tsx`) is functionally strong: versioned, autosave-by-field, Hebrew, required-field markers, file upload per field. An invitation message already exists (`questionnaire_ready`). Sprint Epsilon Customer Experience already named the remaining gap precisely: "the questionnaire is still operated from the shared project screen rather than a dedicated Hebrew-first portal step" — confirmed still true by direct source read in this sprint. | Reuse `questionnaire_ready` as-is; the dedicated-portal-step fix is an engineering item, not new content. |
| Uploads (assets) | client-journey (automated) | Yes | Upload UI has a good rights-ownership warning ("only upload material you own or are licensed to use") but gives no upfront file-size/type limits — customers only learn constraints from a generic failure message ("check the file type and size and try again"). No upload-reminder message exists. | UX fix recommended in Phase 3; add upload-reminder message to the library. |
| Design | ui-ux-designer (automated) | Yes | No dedicated design-checkpoint message exists; the customer only sees the stage label "עיצוב" in the portal. Note: the system has no formal "design approval" gate distinct from final `customer_approval` in `workflows/customer-journey.v1.json` — `approval_required` already covers the final approval moment. | Add an optional, discretionary "design direction" check-in template — clearly scoped as informational, not a formal approval gate, since no such gate exists in the workflow model. |
| Development | frontend-builder (automated) | Yes | Portal shows a live progress bar and stage name, which is good; no development-update message cadence is defined (customer has to keep checking the portal). | Add periodic Development update template; recommend a cadence (e.g., weekly) as an owner decision, not invented here. |
| QA | qa (automated) | Yes | QA is internal-only by design (correct — customers shouldn't see internal QA). No customer message marks "QA complete, review is next," so the jump from "development" to "customer_review" is unexplained. Confirmed still open — not listed among the five existing templates. | Add QA-completion → customer-review handoff message. |
| Customer review / Approvals | owner (gate) | No | The approve/request-changes UI (`review()` in portal.tsx) is clear and gives instant confirmation text; the invitation message already exists (`approval_required`). Two real gaps remain: the "אישור האתר" (approve website) button has no confirmation step before an action the business rules treat as significant, and the revision allowance (two included rounds per `BUSINESS-RULES.md`) is never shown to the customer, so they can't self-track rounds remaining. | UX fixes in Phase 3; surface revision count from the existing versioned policy — do not invent a different number. No new message template needed here (reuse `approval_required`). |
| Deployment | deployment (owner-gated) | No | Deployment is correctly owner-approval-gated with rollback target (Operations manual). No customer-facing "we are deploying now" message exists — first the customer knows is when the site is live, which the existing `website_published` message already handles well. | Optional short deployment-window heads-up template (discretionary, per project) — `website_published` already covers the "it's live" moment and is not being replaced. |
| Delivery | — | No | Distinct from the "it's live" message: delivery requires "documentation, access, asset inventory, support route and maintenance scope" per the operations manual, and no template bundles this handoff for the customer. Confirmed genuinely new — not one of the five existing templates. | Add Delivery template; reference only the support/maintenance terms already defined in `SUPPORT-PLAYBOOK.md`, not new ones. |
| Maintenance | maintenance (automated monitoring) | Yes | Maintenance scope/exclusions are explicitly "owner must approve before launch" (`SUPPORT-PLAYBOOK.md`) — not yet finalized. | Templates below use placeholder scope language pending that approval; do not pre-fill specifics. |
| Support | support (automated triage) | Yes | Support ticket form (`CustomerSupport` in portal.tsx) collects subject/description/priority only. The documented intake standard (`SUPPORT-PLAYBOOK.md`) also expects affected URL, screenshots, and business impact — the live form is narrower than the written policy. No ticket-confirmation or resolution message template exists. | Concrete, code-verified gap — recommend the form-field gap to engineering (not fixed here); add the missing message templates to the library. |
| Project completion | — | No | No "project complete / offboarding" message exists, and no satisfaction/feedback ask is triggered anywhere. Note: any *testimonial* ask specifically requires owner-approved external communication (`FIRST-CUSTOMER-RUNBOOK.md`) — kept distinct from an internal satisfaction question in the library. | Add Completion template + lightweight internal satisfaction ask (Phase 6); testimonial requests stay a separate, owner-approved action. |

**Cross-cutting friction found across all stages:** every stage transition without an existing template is *silent* — the customer must return to the portal to notice a change. Five of roughly fifteen touchpoints already have a drafted message (all owner-approval-gated before any real send, per policy); this sprint's communication library fills the remaining ones in the same format so every stage has *something* ready for the owner to approve and send, not so any of it sends automatically.

**Missing trust signals found:** no visible team/founder identity anywhere in the customer-facing surfaces or in the existing templates (all sign "צוות PageLoom," never a named person) — a premium local-service brand often benefits from a named point of contact, but changing the existing five templates' sign-off is an owner style decision, not made unilaterally here; the new templates in this sprint match the existing "צוות PageLoom" convention for consistency and flag the named-contact idea as an option in Phase 3 instead. No visible "why we ask for this" microcopy on the questionnaire beyond the general security note.

---

## Phase 3 — Customer portal UX review

Reviewed source: `apps/web/src/components/sign-in.tsx`, `portal/page.tsx`, `document-center.tsx`, `legal-center.tsx`, `customer-portal-access.tsx`, `notification-inbox.tsx`.

**What's already strong (do not change):**
- Hebrew/RTL is applied correctly and consistently (`dir="rtl" lang="he"`) on every customer-facing surface.
- Every async action has a loading, success, and error state with `role="status"` / `role="alert"` / `aria-busy` wired correctly — this is genuinely good accessibility practice, better than most SMB sites.
- The upload flow states the rights/ownership condition before use, which is a real trust signal.
- Progress bar has correct `role="progressbar"` and ARIA value attributes.
- `DocumentCenter` correctly flips direction (`rtl` for the client, `ltr` for staff) rather than forcing one direction on both audiences.

**Issues found, ranked by customer-confidence impact:**

1. **E-signature uses raw browser `window.prompt()` dialogs** (`document-center.tsx`, `sign()` function) to collect the signer's full name and intent text. This sprint's own source read confirms the code is exactly as `SPRINT-EPSILON-CUSTOMER-EXPERIENCE.md` already named it (friction #2: "signature collection still uses raw browser prompts; functional but not a polished consent screen; blocked on legal defining the ceremony"). Not a new finding — restated here because it remains unresolved and is the single biggest professional-appearance risk in the customer surface, precisely because it sits at the Contract stage. It is explicitly gated on legal defining the exact consent ceremony (Phase 8 blocker 1), so a UI fix alone can't fully close it — but the modal pattern already exists elsewhere in the product (`portal/page.tsx`'s support-ticket dialog) and could replace the raw prompt once the ceremony wording is approved.
2. **No confirmation step before final website approval.** Clicking "אישור האתר" fires immediately. A one-line "does this look right? this sends your approval to the PageLoom team" confirmation would reduce accidental submissions and increase perceived seriousness of the action. New observation, not previously documented.
3. **No visible revision-round counter.** The customer cannot see how many revision rounds they have used or have left, even though the policy (two included rounds) already exists in `business-rules.ts`. Silence here creates avoidable "how many changes do I get" support tickets. New observation.
4. **Upload constraints are reactive, not proactive.** File type/size limits are only communicated after a failed upload via a generic message. Stating the accepted types/size up front (once product defines the actual limits — not invented here) removes a failure loop. New observation.
5. **Support ticket form is narrower than the documented intake standard** (see Phase 1 table) — no URL field, no screenshot attachment, no business-impact field, despite `SUPPORT-PLAYBOOK.md` expecting all of these. This directly slows triage. New observation, code-verified.
6. **No named human point of contact anywhere in the customer surface.** Every message is institutional ("PageLoom team"/"צוות PageLoom"), consistent across the code and all five existing templates. For a premium, relationship-led local agency, a named founder/PM signature on key messages (proposal, contract, delivery) can read as more trustworthy — offered here as an optional owner style decision, not applied to this sprint's new templates so they stay consistent with the existing five.
7. **The questionnaire living on the shared project screen instead of a dedicated step** is also already-documented (Sprint Epsilon Customer Experience, friction #1) and confirmed still present by this sprint's direct source read of `portal/page.tsx` — restated for completeness, not new.
8. **Empty/loading microcopy is consistently good** — no changes recommended there; called out so it isn't mistaken for an oversight.

Items 1 and 7 are confirmations of already-known, still-open findings; items 2–6 are new. None were implemented in this sprint (mission scope is business assets, not code) — they are handed off as a prioritized, evidence-based punch list.

---

## Phase 4 — Sales optimization

Constraint respected: sales is explicitly **human-first** by policy (`customerAiInteraction: false`, "no AI selling," founder phone close). This sprint therefore produces support material for the human seller, not automation.

**Proposal flow.** The proposal is already correctly gated (owner-approved, versioned, delivered under a send gate). What's missing is the *human* delivery layer: a short cover message so the proposal doesn't arrive as a bare document. Added to the communication library.

**Value proposition (as it can be stated without inventing pricing or claims):** PageLoom's demonstrable, evidence-based differentiators from the existing system are (a) a named, single accountable owner for every deal and delivery — not a queue; (b) a live customer portal with real-time progress, not email chains; (c) versioned, hash-verified legal/delivery documents with signature audit trail; (d) explicit, policy-bound revision rounds instead of open-ended scope. These are structural facts already built into the product, not marketing claims — safe to use in proposal/positioning language.

**Objection handling — FAQ structure** (content architecture only, per Phase 5 instruction not to write long copy):
- "How do I know you'll deliver on time?" → point to the live portal + progress percentage as the answer, not a promise.
- "What if I don't like the design?" → point to the actual, existing two-revision-round policy — do not promise unlimited revisions.
- "Is my data safe?" → point to the actual backup/retention facts already defined (90-day backup retention, 24h RPO, 4h RTO) rather than generic reassurance.
- "What happens after launch?" → point to the actual maintenance/support model once the owner finalizes its public wording (currently gated).
- Pricing objections → explicitly **not answered here**; no pricing exists to reference, and Business Operations policy requires zero self-authorized discounts. Sales must handle pricing conversation manually per policy.

**Trust building / closing:** the strongest asset PageLoom has and isn't using yet is the delivery-quality evidence already produced internally (Golden Customer rehearsal passed, per `LAUNCH-READINESS.md`) — this is safe to reference internally in sales conversations as proof of process, not as a public case study until an actual paying customer exists.

**Follow-up process:** no follow-up cadence exists today. Recommend (not enforced): one follow-up at +2 business days if a lead goes quiet after discovery, one at +5 days after a proposal is sent, matching the 5-day inactivity threshold already defined in `business-rules.ts` for projects — reusing an existing number rather than inventing a new one.

---

## Phase 5 — Marketing & SEO content architecture

Structure only, per instruction not to write long-form content.

**Website structure**
- Home
- Services (index) → individual service pages (one per offering once the service catalog is finalized — not invented here, since the actual service list lives in product/pricing configuration, not this sprint)
- Process / How it works (can reuse the actual 16-stage journey from Phase 1 as the public-facing simplified version — 5–6 customer-visible steps: Discovery → Proposal & Contract → Questionnaire & Design → Development & Review → Launch → Support)
- Case studies (index) → individual case study pages (empty until Customer #1 delivers — do not fabricate placeholder customers)
- About / Trust (accountable owner, process transparency, security/backup facts — reuse real facts only)
- Contact / Start a project

**Landing page structure** (per campaign, reusable skeleton): Hero (offer + who it's for) → Proof (process transparency, not fabricated testimonials) → What's included → How it works (link to Process) → FAQ (reuse Phase 4 FAQ objection list) → CTA (Discovery call booking).

**Service page structure** (per service): What it solves → What's included → Process tie-in → FAQ subset → CTA.

**Knowledge Base structure:**
- Getting started (what to expect after signing)
- Your project (questionnaire, uploads, revisions, approvals — this can be sourced almost verbatim from the communication library and portal copy already written)
- Support & maintenance (once owner finalizes public policy wording)
- Account & access

**Blog categories:** Local business web strategy · Design & branding · Behind the process (process-transparency content, PageLoom's real differentiator) · Customer stories (empty until real customers exist).

**FAQ structure:** Sales objections (Phase 4) + Support/process questions (Knowledge Base) — one canonical FAQ source feeding both, not two diverging FAQ sets.

**Case Study structure (template, unpopulated):** Customer + industry → Starting problem → What PageLoom did (process, not internal tooling detail) → Result (only real, measurable outcomes once available) → Quote (only if genuinely obtained and permitted).

**Customer Success Story structure:** shorter variant of the case study, optimized for social/WhatsApp sharing — Problem (1 line) → Result (1 line) → Link to full case study.

---

## Phase 6 — Customer success review

Support process, SLA wording, and escalation flow already have a real source of truth: `docs/SUPPORT-PLAYBOOK.md`. This sprint does not rewrite it — it is well-specified and internally consistent (severity table, intake fields, recovery steps, security-incident handling). Two things it explicitly and correctly leaves open are owner decisions, not gaps to fill: business hours and the exact support channel.

**Customer expectations setting:** currently nothing tells the customer what support commitment applies until they hit "open a ticket" and see a computed due-date. Recommend surfacing the same acknowledgment targets already defined in the playbook (2 business hours for critical, 1 business day otherwise) as visible text *before* they submit — reusing the existing numbers, not new ones.

**Escalation flow:** already correctly defined (playbook severity table + owner-approval gate on production changes). No change recommended.

**Resolution communication:** the ticket UI already displays `resolution` text once set — good. No template exists yet for a support agent to draft that resolution message in a consistent voice; added a lightweight resolution-message pattern to the communication library.

**Satisfaction process:** does not exist anywhere in the system today. Recommend a single, short, optional post-completion and post-ticket-resolution satisfaction question (not a full survey) — added to the communication library as the Completion template's closing line, not as new infrastructure.

---

## Phase 7 — Business documentation audit

Reviewed: all files under `docs/` and `docs/company/`.

**No duplicate content found** between the company knowledge base (`docs/company/*`, internal/English/source-of-truth) and the operational docs (`docs/*.md`) — the `docs/company/README.md` functional knowledge map explicitly routes each function to one primary + one supporting source, and the actual files respect that split.

**Outdated information:** none identified as factually stale; `LAUNCH-READINESS-REPORT-2026-08-16.md` is the most recent dated report and the other sprint reports read as a coherent, non-contradictory history rather than superseded drafts.

**Missing documentation, confirmed by direct inspection (not assumption):**
- A customer communication template library existed only partially before this sprint (5 of ~15 touchpoints, in `israel-localization.ts` — confirmed by direct code read, not just search). This sprint fills the rest in the same format, not from scratch.
- No public-facing content architecture existed before Phase 5 (filled now, structure-only).
- No discovery-call guide exists for the founder (identified in Phase 4, not authored here — recommend as a short, separate owner-authored artifact since it reflects personal sales style, not policy).

**Two specific hygiene items resolved-vs-open, verified directly rather than assumed:**
- The report-loader hook-dependency lint warning that `SPRINT-GAMMA-BUSINESS-HARDENING.md` flagged as a low-severity remaining action is confirmed **already fixed** — `docs/company/LAUNCH-READINESS.md` ("Weak points hardened in Delta") states it explicitly: "Removed the report-loader hook dependency warning by stabilizing its authenticated query callback." No further action needed; noted here only to close the ambiguity rather than leave it unresolved.
- The rehearsal dead-letter dashboard cleanup flagged in the same Gamma report is confirmed **still open** — `docs/LAUNCH-BOARD.md` lists "Rehearsal queue cleanup" under IN PROGRESS (30-minute estimate, operations owner). Carried into Phase 8 as a real, low-effort launch item.

**Terminology consistency:** stage names are consistent between `workflows/customer-journey.v1.json` (English machine IDs) and the Hebrew portal labels (`stages` map in `portal/page.tsx`) — verified by direct cross-reference, no mismatch found. The one soft inconsistency: `docs/company/OPERATIONS-MANUAL.md` calls the pre-development phase "Website production" while the code calls it a group of distinct automated stages (`planning`, `ui_design`, `development`) — not a contradiction, just a rollup; no fix needed.

**Reuse applied in this sprint:** support/SLA numbers, revision-round policy, backup/retention figures, and the 5-day inactivity threshold were all pulled from `business-rules.ts`/`SUPPORT-PLAYBOOK.md` rather than restated or reinvented, exactly per instruction.

---

## Phase 8 — Business launch review (assume Customer #1 signs tomorrow)

Ignoring software implementation as instructed; focused purely on what would visibly reduce a real customer's confidence tomorrow.

**Blocking — these are exactly the four external gates in `SPRINT-EPSILON-BUSINESS-READINESS.md` (94%, Conditional GO); no content work in this sprint closes them:**
1. **Legal text is not counsel-approved** (legal/commercial scores 76%, the lowest area). No amount of communication polish substitutes for an approved Hebrew agreement, privacy policy, terms, DPA, or e-signature consent wording.
2. **Finance**: owner + accountant have not yet approved the Customer #1 quote/payment/tax/refund process or invoice provider.
3. **Support channel and business hours are still unstated to any customer.** Until the owner picks the channel/hours, there is nothing accurate to put in the delivery message or portal — the recommended 2-business-hour/1-business-day targets in `SUPPORT-PLAYBOOK.md` remain a draft pending that approval.
4. **Deployment**: each release still requires explicit owner approval per the standing policy — expected and correct, not a defect.

**Contract e-signature UI is a raw browser prompt** — already known (Sprint Epsilon Customer Experience, friction #2) and still open. If Customer #1 signs through this flow, their first "legal moment" with PageLoom looks unfinished — but it's explicitly blocked on legal defining the consent ceremony (blocker 1 above), so it can't be fixed in isolation before that.

**High-impact, fixable this week without code or legal review:**
5. Ten of roughly fifteen customer-journey touchpoints had no drafted message before this sprint (five already existed — see the template inventory above); the accompanying library fills the gap. None of it sends automatically — the owner still approves and sends each one manually, per standing "no AI selling" / owner-approval policy.
6. No named human presence in the customer-facing product or in any existing template — offered as an optional owner style decision (Phase 3), not changed unilaterally.
7. No visible revision-round count for the customer, despite the policy already existing — a five-minute display fix once engineering picks it up.
8. **Rehearsal queue cleanup is still open** (`docs/LAUNCH-BOARD.md`, "IN PROGRESS," 30-minute estimate, operations-owner task) — historical non-customer dead letters remain visible and should be archived before a real customer sees the dashboard. Low effort, real launch-confidence item.

**Non-blocking but noticeable:** no case studies/testimonials (expected and correct — nothing to show before Customer #1; do not fabricate), no visible FAQ/objection handling on any customer-facing surface yet (addressed structurally in Phase 5, needs actual page content once site copy work is greenlit).

**Business launch recommendation:** proceed toward Customer #1 on the schedule already set by the owner (legal + support-policy approval remain the two owner-gated items), and treat the e-signature UI fix as a fast-follow before the *first* real contract is signed through it, not before launch generally — a founder can still close Customer #1 by phone/manual process per the existing "founder phone close" policy while that fix lands.

---

## Sources consulted (for traceability, not exhaustive)

`workflows/customer-journey.v1.json` · `templates/customer-questionnaire.schema.json` · `packages/core/src/documents.ts` · `docs/company/BUSINESS-RULES.md` · `docs/company/CEO-HANDBOOK.md` · `docs/company/LAUNCH-READINESS.md` · `docs/company/OPERATIONS-MANUAL.md` · `docs/SUPPORT-PLAYBOOK.md` · `docs/BUSINESS-OPERATIONS.md` · `apps/web/src/components/{sign-in,document-center,legal-center,customer-portal-access,notification-inbox}.tsx` · `apps/web/src/app/(product)/portal/page.tsx` · prior sprint reports Alpha–Epsilon (cross-referenced, not duplicated).
