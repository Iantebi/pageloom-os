# Changelog

## Sprint Beta — Israel Localization

- Defaulted customer and website-project records to Hebrew while preserving English engineering operations.
- Added client-specific Hebrew/RTL shell behavior and localized the customer portal, authentication, and legal center.
- Added reusable Hebrew email and WhatsApp draft templates.
- Added versioned Hebrew customer-document contracts and Israel-ready tax/invoice domain models.
- Added localization tests and operational documentation without changing provider, workflow, or infrastructure architecture.

## Unreleased

### Added

- Executive finance and profitability calculations.
- Business package and quote calculations.
- Approval-gated dry-run customer project factory.
- Enterprise finance, infrastructure, incident, and backup dashboard.
- Immutable legal document and acceptance foundations.
- Customer portal legal center.

### Security

- Cloud provisioning cannot execute from the planning API.
- Project-factory plans are idempotent and require CEO approval.
- Legal acceptances bind to exact published document hashes.
- Finance mutations require owner or administrator authority.
