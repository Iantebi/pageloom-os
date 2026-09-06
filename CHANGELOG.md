# Changelog

## Sprint Zeta — Identity Hardening

- Added staged, opt-in TOTP multi-factor authentication for Owner/Admin: enrollment/sign-in/recovery UX, an in-app Owner-triggered MFA reset, and a CLI recovery path for a locked-out sole Owner — off by default, cannot lock out an existing user.
- Added Firebase App Check client initialization and server-side monitoring-only verification, gated entirely behind an optional site-key env var; never rejects a request and leaves Console enforcement untouched.
- Documented the full design, security model, test plan, staged rollout, and recovery runbook under `docs/mfa-app-check/`.

## Sprint Epsilon — Launch Experience

- Simplified the Hebrew customer portal around progress, assets, website preview, comments, revisions and approval with accessible loading/error/progress states.
- Added deterministic Lead-to-Delivery journey timing and a complete Golden Customer regression path.
- Refined customer legal/document presentation and professional Hebrew HTML/PDF output with print layout and page numbering.
- Added customer, owner and business-readiness launch reports.

## Sprint Delta — Company Operating System

- Added the governed business blueprint, company wiki, operations manual, financial framework, CEO handbook, reporting cadence, risk register, and launch roadmap.
- Added validated, versioned business rules for delivery, commercial approvals, support, hosting, recovery, retention, and lifecycle policy.
- Hardened the business report loader and eliminated its unstable-hook lint warning.

## Sprint Gamma — Business Hardening

- Added a versioned enterprise document engine with Hebrew HTML/PDF rendering, private artifacts, integrity hashes and digital-signature evidence.
- Added the CEO command center, business intelligence, approval-gated fleet manager and customer infrastructure health model.
- Added seven business report families with verified PDF/CSV exports.
- Added idempotent business-risk monitoring for domains, SSL, backups, inactivity, stalled delivery and negative profitability.
- Hardened API errors, Firestore/Storage isolation, shared-core packaging and browser source control.

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

- API error responses no longer echo raw internal error messages to callers; failures are logged server-side and callers receive a fixed generic message instead.
- Cloud provisioning cannot execute from the planning API.
- Project-factory plans are idempotent and require CEO approval.
- Legal acceptances bind to exact published document hashes.
- Finance mutations require owner or administrator authority.
