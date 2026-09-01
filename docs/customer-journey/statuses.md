# Customer Journey — Statuses and Stages

## Workflow stages (`packages/core/src/workflow.ts`)

The single source of truth for a project's lifecycle position is
`project.workflowStage`, one of `WorkflowStage`:

```
lead → phone_call → closed_won → payment_confirmed → onboarding → questionnaire → assets
→ research → brand_strategy → design_system → sitemap → ux_planning → ui_generation
→ copywriting → seo_optimization → development → deployment_preparation → qa
→ ceo_approval → production_deployment → customer_review → revision → final_deployment
→ completed
```

Only `payment_confirmed` is new. Everything else already existed.

## The new `payment_confirmed` stage

- `startMode: "manual"` — never automatic. Entered only via
  `POST /api/projects/:id/payment-confirmed` (Owner-only).
- `entryConditions: []` — deliberately has no entry-condition fact requirement.
  `POST /api/projects` (the existing deal-closing endpoint) writes `journeyStage`
  directly and never emits engine events, so a freshly closed project's
  `workflowStage` is often not yet engine-initialized. The real authorization gate is
  the endpoint's own explicit `dealClosedAt` Firestore check, not an engine fact.
- On confirmation, the endpoint synchronously drives the engine through
  `PaymentConfirmed → OnboardingStarted → OnboardingCompleted`, landing the project in
  `"questionnaire"` with the Website Brief questionnaire already created — see
  `automation-events.md`.

## Payment state (on the customer document)

Recorded on `organizations/{orgId}/customers/{customerId}`, **never** on any
publicly-readable path, and never including card details:

- `paymentStatus: "paid"` (reuses the existing enum from `customer-admin-api.ts`)
- `paymentReference: string` — an opaque reference (e.g. an invoice or payment-intent
  id), not a card number
- `paymentConfirmedAt`, `paymentConfirmedBy`

## Customer-facing timeline buckets

See `timeline.md` for how the 22 internal stages map onto the mission's 10
customer-facing buckets (`Payment received → Website brief → Materials → Building →
Client review → Revisions → Final approval → Publishing → Live → Support`).

## Revision request status (`packages/core/src/revision-requests.ts`)

`RevisionRequest.status`: `"open" | "resolved"`. Stored at
`organizations/{orgId}/projects/{projectId}/revisionRequests/{id}`.

## Launch checklist item status (`packages/core/src/launch-checklist.ts`)

`LaunchChecklistItem.complete: boolean`, `required: boolean`. Stored at
`organizations/{orgId}/projects/{projectId}/launchChecklist/current`.
