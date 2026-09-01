# Customer Journey — Flow

The end-to-end journey from a successful phone payment through website launch and
post-launch support. This document is the operational specification; the numbered
sections below match the mission's own numbering.

## Lifecycle

```
Lead → Closed Won → Payment Confirmed → Welcome → Website Brief → Materials Collection
→ Ready for Build → In Build → Client Review → Revisions → Final Approval
→ Ready to Publish → Live → Handover → Support / Follow-up
```

## What this reuses vs. what is new

This feature deliberately does **not** introduce a parallel pipeline. It extends the
existing systems already in the codebase:

| Journey stage | Existing system reused | What's new |
|---|---|---|
| Lead → Closed Won | `packages/core/src/workflow.ts` (`WorkflowEngine`), `POST /api/projects` | — |
| Payment Confirmed | `closing-api.ts`'s manual payment confirmation pattern | New `payment_confirmed` workflow stage + `POST /api/projects/:id/payment-confirmed` |
| Welcome | Customer Portal (`apps/web/src/app/(product)/portal`) | `WelcomePanel` component |
| Website Brief | The existing generic questionnaire system (`createQuestionnaireSchema`, `POST /projects/:id/questionnaires(/complete)`) | A predefined field list (`websiteBriefFields`), auto-created at payment time |
| Materials Collection | The existing `assets` workflow stage, `POST /projects/:id/assets/validate` | Missing-materials surfacing in Owner Control and the portal |
| Client Review / Revisions | The existing `customer_review`/`revision` stages and `CustomerApproved`/`CustomerRequestedRevision` events | Structured, resolvable revision requests (`revisionRequests` subcollection) alongside the existing coarse approve/request-changes buttons |
| Final Approval | The existing `CustomerApproved` event | Now actually sets `project.customerApprovedAt` (previously declared but never written) and fires an explicit `final_approval_recorded` notification |
| Ready to Publish | The existing `ceo_approval`/`production_deployment`/`final_deployment` CEO-approval gates (unchanged — still the only thing that authorizes a deployment) | A pre-publish launch checklist (`launchChecklist()`), visibility only |
| Live / Handover | `project.websiteUrl` (already read by the portal) | `POST /projects/:id/handover`, recorded once |
| Support / Follow-up | The existing support ticket system (`operational-records-api.ts`) | Linked from the handover panel |

See `statuses.md` for the exact stage/event model, `automation-events.md` for the
notification map, `questionnaire.md` for the Website Brief field list, `timeline.md`
for the customer-facing bucket mapping, `owner-workflow.md` for what Owner sees, and
`launch-checklist.md` for the pre-publish checklist.

## Production safety

Payment confirmation is, and remains, a manual Owner action
(`POST /api/projects/:id/payment-confirmed`, `owner`-role only). There is no
Stripe-webhook-driven or scheduler-driven automatic advancement anywhere in this
feature — the existing Stripe webhook handler (`functions/src/api.ts`) still only
records the raw event; nothing reads it.
