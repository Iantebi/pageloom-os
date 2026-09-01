# Customer Journey — Owner Workflow

`apps/web/src/components/onboarding-journey-panel.tsx`, added as a new "Onboarding"
tab on the existing per-project staff view
(`apps/web/src/app/(product)/projects/view/page.tsx`) — the same place Owner already
manages tasks, approvals, and the questionnaire for a project.

## What Owner sees, per project

- **Materials**: missing required Website Brief fields/files (computed via
  `missingRequiredQuestionnaireFields`, the same non-throwing helper used by the new
  Owner-overview endpoint).
- **Revision requests**: every open structured revision request, with a one-field
  resolve action (records a resolution note, notifies the customer, sets status to
  `resolved`).
- **Launch checklist**: the pre-publish checklist (see `launch-checklist.md`), with a
  ready/not-ready badge computed from the checklist's `required` items.
- **Handover**: a form to record the live URL, support instructions, maintenance
  info, and both parties' responsibilities — shown once, then replaced with a
  confirmation once recorded.

## Organization-wide overview

`GET /api/organizations/:organizationId/onboarding-overview` (owner/admin/operator/
member) — one aggregated read across every project with a closed deal, returning per
project: `workflowStage`, `actionRequired` ("customer" | "owner" | "none"),
`missingMaterials`, `lastActivityAt`, `nextAction`, `overdue`, `openRevisionCount`,
`finalApprovalRecorded`, `launchReady`. This is the read the mission's "Owner Control"
section describes; a dedicated org-wide dashboard widget consuming it can be added on
top without further backend work.

## Security

Every route above enforces the existing role model
(`requireRole`/`requireProjectAccess` from `functions/src/auth.ts`) — owner/admin/
operator for mutating staff actions, and the existing client-project-scoping for
anything a customer can read. No new role, permission key, or RBAC concept was
introduced.
