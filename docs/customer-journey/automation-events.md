# Customer Journey — Automation / Event Map

No real WhatsApp, SMS, or email is sent anywhere in this feature. Every notification
below is an in-app `organizations/{orgId}/notifications` document, formatted by
`apps/web/src/lib/i18n/dictionaries/notifications.ts` (Hebrew + English), following the
exact pattern already used for `support_ticket_created`, `website_content_submitted`,
etc.

| Trigger | Notification `type` | Audience | Producer |
|---|---|---|---|
| Owner confirms payment | `payment_confirmed` | customer | `onboarding-journey-api.ts` (`POST /projects/:id/payment-confirmed`) |
| Customer submits the Website Brief | `website_brief_received` | owner | `api.ts` (`POST /projects/:id/questionnaires/:id/complete`, only when the questionnaire's `kind === "website_brief"`) |
| Materials fail validation | `materials_missing` | owner | `api.ts` (`POST /projects/:id/assets/validate`, missing-files branch) |
| Materials pass validation (build starts) | `build_started` | customer | `api.ts` (`POST /projects/:id/assets/validate`, success branch) |
| Preview ready for review | `preview_ready` | — | **Template only.** The stage that produces a customer-reviewable preview (`ProductionDeploymentCompleted`) is emitted deep in orchestrator/deployment internals not touched by this feature; wiring the producer call is a follow-up, not blocked on anything here. |
| Customer submits a revision request | `revision_received` | owner | `onboarding-journey-api.ts` (`POST /projects/:id/revision-requests`) |
| Owner resolves a revision request | `revision_resolved` | customer | `onboarding-journey-api.ts` (`PATCH /projects/:id/revision-requests/:id/resolve`) |
| Customer gives final approval | `final_approval_recorded` | owner | `workflow-engine.ts` (on the `CustomerApproved` event) |
| Owner records handover / site goes live | `website_live` | customer | `onboarding-journey-api.ts` (`POST /projects/:id/handover`) |
| Post-launch follow-up | `post_launch_follow_up` | — | **Template only.** Deliberately not scheduled — the mission's production-safety section explicitly excludes Scheduler changes from this work. |

## Why two items are "template only"

The mission's instruction is to "build the notification/event architecture and
templates first" and explicitly forbids sending real messages or touching the
Scheduler in this pass. `preview_ready` and `post_launch_follow_up` have their full
type definition and Hebrew/English copy already in `notifications.ts` (so a future
producer just writes `{type, params}` and it renders correctly), but wiring their
actual trigger points was intentionally left out because:

- `preview_ready`'s natural trigger (`ProductionDeploymentCompleted`) lives inside
  deployment/orchestrator internals this feature doesn't otherwise touch, and forcing
  a producer call there without understanding that pipeline risked exactly the kind
  of unrelated architecture change the mission asks to avoid.
- `post_launch_follow_up` is inherently time-delayed (some days/weeks after launch),
  which means a Scheduler — explicitly out of scope for this production-safety pass.

## Workflow-level notifications (unchanged, pre-existing)

Every workflow stage transition already produces a generic `workflow_stage_changed`
notification (`workflow-engine.ts`). The new `payment_confirmed` stage participates in
this the same way every other stage does — no changes were needed there.
