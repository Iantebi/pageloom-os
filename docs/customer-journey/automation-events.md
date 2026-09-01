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
| Preview ready for review | `preview_ready` | customer | `workflow-engine.ts` (on the `ProductionDeploymentCompleted` event, the same central `process()` transaction as `final_approval_recorded`) |
| Customer submits a revision request | `revision_received` | owner | `onboarding-journey-api.ts` (`POST /projects/:id/revision-requests`) |
| Owner resolves a revision request | `revision_resolved` | customer | `onboarding-journey-api.ts` (`PATCH /projects/:id/revision-requests/:id/resolve`) |
| Customer gives final approval | `final_approval_recorded` | owner | `workflow-engine.ts` (on the `CustomerApproved` event) |
| Owner records handover / site goes live | `website_live` | customer | `onboarding-journey-api.ts` (`POST /projects/:id/handover`) |
| Post-launch follow-up | `post_launch_follow_up` | — | **Template only — see below.** |

## Why `post_launch_follow_up` is still template-only

Every other notification in this table fires as the *immediate* consequence of some
event (a request arriving, a stage transitioning). `post_launch_follow_up` is
different in kind: it means "check in with the customer some days/weeks after
launch," which has no triggering event to hang off of — correct behavior requires
something to wake up on a schedule and ask "has enough time passed since handover?"
That is a Scheduler by definition, whether it's a brand-new `onSchedule` function or
added logic inside an existing one (`monitorWorkflowTimeouts`,
`monitorBusinessRisks`, etc.) — either way it changes what runs on a schedule in
production, which this pass's explicit constraint is to avoid. `notifications.ts`
already has the full `post_launch_follow_up` type and Hebrew/English copy ready, so
the only remaining work is the scheduled producer itself.

### Exact future implementation

When a Scheduler change is separately approved:

1. Add a `followUpSentAt?: string` field to the `Handover` record
   (`packages/core/src/handover.ts`) and to the Firestore document written by
   `POST /projects/:id/handover`.
2. Add a new `onSchedule` function (e.g. `sendPostLaunchFollowUps`, modeled on the
   existing `monitorBusinessRisks` — `every 1 hours` cadence is more than sufficient
   for a days-later check) that:
   - Queries `collectionGroup("handover")` where `followUpSentAt` is unset and
     `createdAt` is older than the desired follow-up window (e.g. 7 days).
   - For each match, writes a `post_launch_follow_up` notification
     (`audience: "customer"`, `params: { projectName }`) exactly like every other
     producer in this table, then sets `followUpSentAt` on the handover doc so it is
     never sent twice.
3. No new external service, no IAM change, no billing change — this reuses the exact
   `onSchedule`/Firestore/notification pattern already deployed for
   `monitorWorkflowTimeouts` and `monitorBusinessRisks`, just with a new function
   name and query.

## Workflow-level notifications (unchanged, pre-existing)

Every workflow stage transition already produces a generic `workflow_stage_changed`
notification (`workflow-engine.ts`). The new `payment_confirmed` stage participates in
this the same way every other stage does — no changes were needed there.
