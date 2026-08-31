# PageLoom Launch Board

Last updated: August 31, 2026. Customer #1 target: September 1, 2026.

## READY

| Critical-path capability | Evidence |
|---|---|
| Phone close | Owner-only Closed Won transition gates all project work |
| Questionnaire and assets | Versioned required fields, project-scoped uploads, and asset validation |
| Orchestration control | Agents start only through the central orchestrator |
| Provider-independent launch policy | Automatic inference is disabled; manual AI tasks require no provider API |
| Manual AI queue | Verified context, exact prompts, output contracts, owner submission, and resumption |
| Workflow recovery | Retries, dead-letter recovery, rollback rules, and audit events |
| Customer access | Verified-email invitation and customer/project tenant isolation |
| Generated-file security | Project artifacts are customer-scoped; internal artifacts are staff-only |
| Human authority | CEO approval gates production deployment and other critical actions |
| Operating process | First-customer, release-acceptance, and support runbooks |
| Golden Customer rehearsal | Production path completed at 100% with zero pending/failed tasks and a verified live URL |
| Deployment ordering | Verified HTTPS deployment evidence is persisted before project completion |
| Revision deployment safety | Re-entered stages receive unique attempts and idempotency keys |
| Production monitoring & alerting | 10 Cloud Monitoring alert policies (backup failure/freshness, scheduler failure, function errors, memory exhaustion, permission failures, 5xx/availability, Service Health, dead-man heartbeat) live and verified, routed to a single email channel; Essential Contacts configured |
| Backup freshness watchdog | Scheduled every 6h; independently verifies Firestore and Storage Transfer backup freshness and Google Cloud Service Health, with its own dead-man detection if it stops running |
| Firestore backups | Daily export, 90-day retention, 19+ consecutive days verified with zero gaps, delete protection enabled |
| Customer media backups | Object Versioning + weekly Storage Transfer job to an isolated backup bucket, both the live run and a manual test verified successful |
| Restore verified | A real Firestore export was imported into an isolated temporary database (`pageloom-restore-drill`), 487/487 documents restored and read back intact, production untouched throughout, temporary database deleted afterward — proves backups are actually recoverable, not merely created |
| Security/tenant isolation tests | Behavioral Firestore + Storage Rules tests run against the real rules engine in CI (JVM-backed emulator): 45/45 passing |
| Full customer lifecycle E2E | New emulator-only harness (`customer-lifecycle.e2e.test.ts`) exercises lead → proposal → contract → payment state → onboarding → project → website → portal → content edit → media upload → draft → submission → Owner approval → publish → revision → rollback → support request, plus cross-tenant isolation, `/master` access denial, protected-field enforcement, and Owner-only actions: 18/18 passing in CI, wired into every future CI run |
| Payment/workflow policy | Explicit, current decision: a successful Stripe payment records state only; workflow advancement stays a manual Owner action (no auto-advance built or planned) |

## IN PROGRESS

| Item | Success condition | Estimate | Dependency |
|---|---|---:|---|
| Customer #1 legal acceptance | Owner/legal approval recorded for the launch pack | 1–3 days | Owner / legal counsel |
| Rehearsal queue cleanup | Historical non-customer dead letters archived under retention policy | 30 min | Operations owner |

## BLOCKED

| Item | Blocker | Owner | Required action | Estimated completion |
|---|---|---|---|---:|
| Legal launch pack | Agreement, privacy, accessibility, and data-processing language lacks owner/legal acceptance | PageLoom owner / legal counsel | Review and approve the customer-facing legal documents before onboarding | 1–3 days |
| Customer #1 production release | Every real production deployment remains an explicit owner gate | PageLoom owner | Approve the exact verified release candidate when presented | 15 min after technical verification |

Neither Gemini nor OpenAI credits are a launch blocker. Payment automation and nonessential integrations remain outside the Customer #1 critical path.
