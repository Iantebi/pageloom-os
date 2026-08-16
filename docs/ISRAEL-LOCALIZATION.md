# Israel localization

PageLoom separates customer experience from engineering operations. Customer records and artifacts default to Hebrew (`he`) and right-to-left (`rtl`). Source code, identifiers, APIs, infrastructure configuration, logs, metrics, and internal CEO tools remain English.

## Customer experience contract

- Customer and project creation defaults to Hebrew. The production intake explicitly preserves that locale through Closed Won and orchestration.
- Authenticated client sessions set the browser document to `lang="he"` and `dir="rtl"`; staff sessions remain English/LTR.
- The client portal, authentication entry point, legal center, progress states, uploads, feedback, revisions, and approval actions are Hebrew.
- Logical CSS properties (`start`, `end`, `inline`) are used so sidebar, spacing, and controls mirror correctly in RTL.
- Customer document metadata requires Hebrew content, RTL direction, semantic version, and lifecycle status. Supported artifacts include proposals, contracts, legal documents, invoices, and project summaries.
- Legal acceptance remains bound to an immutable document type, version, SHA-256 hash, effective date, accepter, and timestamp.

## Customer communications

The shared core contains Hebrew templates for onboarding, questionnaire availability, approval requests, revision receipt, and website publication. Email drafts include a Hebrew subject and body. WhatsApp drafts include a Hebrew message. Both carry `locale: he` and `direction: rtl`.

Template rendering does not send a message. Existing authorization policy still requires owner approval before any external email or WhatsApp transmission.

## Israel tax readiness

The domain layer supports Israeli entity classification, nine-digit business identifiers, ILS, VAT registration, withholding-tax and bookkeeping-certificate flags, and future invoice-provider identifiers. Invoice drafts use integer agorot, an explicit VAT rate in basis points, Hebrew line descriptions, and Israeli document types.

PageLoom deliberately does not hard-code a statutory VAT rate or issue tax documents. The applicable rate must be supplied by an approved tax integration at issuance time. Connecting a certified Israeli invoice provider, validating tax/legal wording, and issuing a real document require owner authorization and professional review.

## Verification

Automated tests enforce Hebrew defaults, RTL metadata, message output, legal version binding, Israeli identifier validation, and deterministic invoice arithmetic.
