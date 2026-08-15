# PageLoom customer project factory

The project factory is the control-plane boundary for dedicated customer infrastructure. It currently creates an idempotent, validated provisioning plan and a CEO approval request. It does not call Google Cloud, enable APIs, link billing, or create Firebase resources until the approved execution adapter is implemented and authorized.

## Required sequence

1. Create customer workspace.
2. Create Google Cloud project in the Customer Production folder.
3. Link the approved Billing Account.
4. Initialize Firebase.
5. Enable the minimum API set.
6. Provision Hosting, Firestore, and Storage.
7. Configure the backup destination and schedules.
8. Configure customer-scoped secrets.
9. Register monitoring, uptime checks, and centralized logging.
10. Register immutable resource identifiers in the PageLoom fleet registry.

Every stage is dependency-checked. Retrying the same organization, customer, and project returns the existing plan rather than duplicating resources.

## Authority boundary

Planning is safe and reversible. Execution requires owner approval because it creates external resources and may link billable services. The executor must use service-account impersonation, never downloaded service-account keys. Billing linkage, production deployment, and destructive rollback remain separately auditable actions.

## Rollback

Provisioning rollback is compensating, not destructive by default. Failed resources are quarantined and reported. Project deletion, billing unlinking, secret deletion, or domain removal requires a new explicit owner approval.
