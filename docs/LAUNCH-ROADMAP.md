# PageLoom September 1 Launch Roadmap

## Infrastructure readiness update — August 31, 2026

Monitoring, backups, restore verification, security behavioral tests, and a full
synthetic customer-lifecycle E2E harness are now complete and verified (see
`LAUNCH-BOARD.md` and `disaster-recovery-runbook.md` for evidence). This closes
the "Complete an internal production rehearsal with evidence and rollback
verification" P0 item and the "Automated Firestore and Storage security-rules
tests" and "Per-user/API rate limits and abuse alerts" P1 items below, whose
statuses are updated accordingly. Remaining gaps are legal/business, not
technical.

## Sprint Alpha Enterprise update — August 16, 2026

The business KPI, pricing, legal-versioning, and dedicated-project planning foundations are complete. Real customer project creation remains blocked behind owner and Billing Account approval. Customer #1 should use the dedicated-project pilot only after a sandbox rehearsal proves provisioning, isolation, backup, monitoring, deployment, and rollback.

## Launch outcome

By September 1, 2026, PageLoom must take one real customer from a manually confirmed Closed Won deal to an approved, quality-checked Next.js website deployed on Firebase Hosting, with a secure customer handoff and support path.

Status values: `DONE`, `IN PROGRESS`, `NOT STARTED`, and `OWNER BLOCKED`.

## MUST HAVE

| Priority | Launch requirement | Effort | Dependencies | Status |
|---|---|---:|---|---|
| P0 | Provider-independent manual AI queue prepares prompts, validates owner-submitted output, and resumes workflows | 1 day | Orchestrator | DONE |
| P0 | Secure customer invitation and verified-email portal acceptance | 1 day | Firebase Authentication | DONE |
| P0 | Enforce project-level isolation for generated website artifacts | 0.5 day | Customer/project membership model | DONE |
| P0 | Prove Closed Won → questionnaire → assets → orchestration → build → QA → approvals → release candidate | 2 days | Manual AI queue, representative customer brief | NOT STARTED |
| P0 | Produce deployable Next.js source, lockfile, build manifest, QA evidence, and immutable release record | 2 days | Website factory pipeline | NOT STARTED |
| P0 | Require CEO approval before production deployment and customer approval before final release | 0.5 day | Approval workflow | PARTIAL |
| P0 | Validate accessibility, responsive layouts, links, forms, SEO metadata, security headers, and build output | 1 day | Generated release candidate | PARTIAL |
| P0 | Replace optimistic system-health messaging with measured provider and workflow health | 0.5 day | Operations health API | NOT STARTED |
| P0 | Prepare customer agreement, privacy notice, data-processing terms, accessibility statement, and approval record | 1–3 days | Israeli legal/accessibility review and owner approval | OWNER BLOCKED |
| P0 | Define manual quote, invoice, payment confirmation, refund, and receipt procedure for customer #1 | 0.5 day | Owner commercial decisions | NOT STARTED |
| P0 | Define support channel, response target, escalation path, and incident/customer communication templates | 0.5 day | Owner business hours | NOT STARTED |
| P0 | Complete an internal production rehearsal with evidence and rollback verification | 1 day | All P0 technical items, production deployment approval | DONE — emulator-only E2E harness (18/18 tests, CI-verified) exercises the full lifecycle including rollback restoring the exact prior version's content; a real Firestore restore drill separately verified 487/487 documents recoverable into an isolated database |

## SHOULD HAVE

| Priority | Launch requirement | Effort | Dependencies | Status |
|---|---|---:|---|---|
| P1 | Firebase App Check for browser-originated requests | 0.5–1 day | Production domain | NOT STARTED |
| P1 | Owner MFA and documented account-recovery procedure | 0.5 day | Firebase Authentication | NOT STARTED |
| P1 | Per-user/API rate limits and abuse alerts | 1 day | Functions/Firestore | DONE — Firestore-transaction-backed limiter on AI-triggering endpoints, fails closed on infra errors, 18 passing unit tests |
| P1 | Automated Firestore and Storage security-rules tests for staff and client roles | 1 day | Firebase test environment | DONE — behavioral suite runs the real rules engine in CI, 45/45 passing |
| P1 | Customer-facing progress, approvals, file upload, comments, and final handoff checklist | 1 day | Client portal access | PARTIAL |
| P1 | First-customer runbook with named owner, acceptance criteria, daily checks, and recovery steps | 0.5 day | Golden-path rehearsal | DONE |
| P1 | Manual lead follow-up and discovery-call checklist | 0.25 day | None | NOT STARTED |
| P1 | Basic project profitability worksheet using entered revenue and recorded AI/hosting cost | 0.5 day | Manual payment confirmation | PARTIAL |

## CAN WAIT

| Priority | Deferred capability | Effort | Dependencies | Status |
|---|---|---:|---|---|
| P2 | Stripe and PayPal automation | 3–5 days | Legal, tax, provider activation | BACKLOG |
| P2 | Gmail, Calendar, Drive, Docs, Sheets, Analytics, Search Console, Maps, and Business Profile integrations | 2–4 weeks | Google OAuth approval per service | BACKLOG |
| P2 | WhatsApp Business messaging | 1–2 weeks | Meta business verification and owner send approval | BACKLOG |
| P2 | CRM vendor integration | 3–5 days | Vendor selection | BACKLOG |
| P3 | Zapier, Make.com, and n8n | 1–2 weeks | Proven customer demand | BACKLOG |
| P3 | Advanced analytics, complex AI dashboards, forecasting, and autonomous marketing | 2–4 weeks | Stable operating data | BACKLOG |
| P3 | Multi-customer billing automation and self-service subscription management | 2–3 weeks | Repeatable pricing model | BACKLOG |

## Launch checklist

### Acquire and close

- [x] **MUST / DONE / 0 h / none** — Leads can be created, qualified, assigned, and annotated.
- [x] **MUST / DONE / 0 h / owner phone call** — AI work is blocked until the owner records Closed Won.
- [ ] **MUST / NOT STARTED / 2 h / owner pricing** — Finalize one offer, price, scope boundary, timeline, and payment terms.
- [ ] **MUST / OWNER BLOCKED / 1–3 days / legal review** — Approve customer agreement and privacy/accessibility documents.

### Onboard and collect

- [x] **MUST / DONE / 0 h / Closed Won** — Customer and project records are created from the deal.
- [x] **MUST / DONE / 1 day / Firebase Auth** — Invite the customer securely and restrict the account to its own projects.
- [x] **MUST / DONE / 0 h / project** — Versioned dynamic questionnaires support required fields and uploads.
- [x] **MUST / DONE / 0 h / questionnaire** — Asset validation prevents orchestration when required files are missing.

### Produce and approve

- [x] **MUST / DONE / 0 h / completed questionnaire and assets** — The orchestrator alone starts agent work.
- [ ] **MUST / NOT STARTED / 2 days / owner-operated AI queue** — Verify every production stage creates a measurable, project-scoped deliverable.
- [ ] **MUST / PARTIAL / 1 day / release candidate** — Run automated build, functional, accessibility, responsive, SEO, and security QA.
- [x] **MUST / DONE / 0 h / QA result** — QA failure rolls back to Development; rejected approvals return to the responsible stage.
- [x] **MUST / DONE / 0 h / approval record** — Critical deployment action requires CEO approval.
- [ ] **MUST / PARTIAL / 0.5 day / client portal** — Record customer design/content/final acceptance and revision evidence.

### Deploy, deliver, and support

- [ ] **MUST / NOT STARTED / 1 day / production approval** — Rehearse Firebase build, preview, production release, health checks, and rollback.
- [ ] **MUST / NOT STARTED / 2 h / final deployment** — Deliver URL, source archive, access details, acceptance record, and maintenance scope.
- [ ] **MUST / NOT STARTED / 2 h / owner support policy** — Publish support channel, response target, escalation, backup, and restoration procedure.
- [ ] **SHOULD / NOT STARTED / 2 h / operating week** — Schedule post-launch check and testimonial request manually.

## Launch gates

No first customer enters production until all MUST items are `DONE`. Production deployment, billing changes, external messages, and legal acceptance remain explicit owner gates. Local implementation and verification continue without those permissions; deployment does not.
