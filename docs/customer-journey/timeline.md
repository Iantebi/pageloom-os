# Customer Journey — Customer Timeline

`apps/web/src/components/customer-journey-timeline.tsx`, shown in the Customer Portal.
Deliberately separate from `<WorkflowTimeline>` (`workflow-timeline.tsx`), which shows
**staff** the raw 22-stage internal pipeline — this groups those into the 10
plain-language buckets from the mission spec, each with what PageLoom is doing,
whether the customer needs to act, and what's next.

## The 10 buckets

```
Payment received → Website brief → Materials → Building → Client review
→ Revisions → Final approval → Publishing → Live → Support
```

## Mapping from `WorkflowStage`

(`apps/web/src/lib/i18n/dictionaries/customerJourney.ts`)

| Bucket | `WorkflowStage` value(s) |
|---|---|
| Payment received | `lead`, `phone_call`, `closed_won`, `payment_confirmed` |
| Website brief | `onboarding`, `questionnaire` |
| Materials | `assets` |
| Building | `research`, `brand_strategy`, `design_system`, `sitemap`, `ux_planning`, `ui_generation`, `copywriting`, `seo_optimization`, `development`, `deployment_preparation`, `qa`, `ceo_approval`, `production_deployment` |
| Client review | `customer_review` (before approval) |
| Revisions | `revision` |
| Final approval | `customer_review` (after `customerApprovedAt` is set) |
| Publishing | `final_deployment` |
| Live | `completed` |
| Support | (shown once `handover` exists) |

"Final approval" is derived from `project.customerApprovedAt` rather than a distinct
stage name, because approval is a *moment* (the `CustomerApproved` event) that happens
inside the `customer_review → final_deployment` transition, not a stage of its own.

This mapping is a presentational simplification only — `project.workflowStage`
remains the single source of truth everywhere else in the system; nothing about the
underlying 22-stage machine changed to produce this view.

## What each bucket shows

For every bucket: current status (the bucket label + position in the 10-step
stepper), what PageLoom is doing, whether the customer needs to act (visually
highlighted when true), and what happens next — directly satisfying "the customer
should never need to ask what is happening with my website."

## Welcome experience

`apps/web/src/components/welcome-panel.tsx` — shown only while the bucket is
`payment_received` or `website_brief` (i.e., until the brief is submitted). Not a
persistent timeline step; it hands off to the ongoing timeline above once the
customer has acted.
