# First Customer Support Playbook

## Service policy to finalize before launch

The owner must approve the support channel, business hours, response targets, maintenance scope, and exclusions before these are communicated to the customer.

Recommended starting policy for customer #1:

- One owner-managed support channel; no autonomous external AI replies.
- Acknowledge critical production outages within 2 business hours and other requests within 1 business day.
- Critical means the public site is unavailable, compromised, or losing customer submissions.
- Content changes, new pages, campaigns, integrations, and redesigns are change requests unless included in the signed scope.

## Intake

Record customer, project, reporter, affected URL, description, time observed, screenshots, business impact, severity, and consent to access relevant data. Never request passwords or API keys through support messages.

## Triage

| Severity | Definition | First action |
|---|---|---|
| Critical | Outage, compromise, destructive data loss, or broken lead capture | Alert owner, preserve evidence, stop risky automation, assess rollback |
| High | Major function unavailable with no reasonable workaround | Assign immediately and give owner a recovery estimate |
| Normal | Defect with a workaround or scoped correction | Add to the project queue and confirm priority |
| Change | New scope or preference | Estimate separately and obtain owner/customer approval |

## Recovery

- Confirm impact before changing production.
- Preserve logs, release IDs, timestamps, and affected paths.
- Prefer the smallest reversible correction.
- Production changes and rollback both require explicit owner approval.
- Verify public routes, forms, customer-visible content, and monitoring after recovery.
- Record cause, resolution, verification, customer communication approval, and prevention action.

## Data and security incidents

Restrict access, preserve evidence, and notify the owner immediately. Do not make legal conclusions or customer notifications autonomously. Follow the approved privacy and incident-notification obligations after legal/owner review.
