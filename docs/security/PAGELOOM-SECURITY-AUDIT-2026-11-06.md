# PageLoom Security Audit — 2026-11-06

## Executive decision

**Not yet approved for real customer data.** The code-level remediation is substantially complete and all runnable unit, regression, lint, type, and production-build checks pass. Release remains blocked until the Firestore/Storage behavioral suite runs successfully against the Firebase emulators and current production backup freshness plus a current isolated restore drill are verified.

No production deployment, Firebase configuration change, data deletion, or merge was performed.

## Scope

- GitHub application: Next.js frontend, Firebase Functions backend, authentication and authorization, Firestore and Storage rules, uploads, logging, dependencies, backup tooling, and regression tests.
- Base44 application `6abd4384abcf8e10634a4a24` (PageLoom Master): entities/RLS, public backend functions, lead intake, CMS-rendered content, uploads, secrets, and platform security scan.

## Remediation completed

### Base44

- Added recursive sanitization before CMS content is persisted and before public rendering. Executable/credential-bearing URLs, control characters, unsafe color values, and HTML angle brackets are rejected or normalized, mitigating stored XSS.
- Added security regression tests for executable URLs and recursively stored content.
- Made Turnstile verification mandatory and fail-closed.
- Added a five-minute HMAC-signed form credential and server-side verification before the public lead function may use service-role writes.
- Added an allowlist for `pageloom.co.il`, `www.pageloom.co.il`, `forms.pageloom.co.il`, and Base44-hosted preview domains when validating the Turnstile hostname.
- Limited lead data and failure logging; failure records exclude lead PII.
- Restricted CMS image uploads to JPEG/PNG/WebP/GIF and 10 MB. These are intentionally public website assets, not private customer documents.

The final Base44 scan reports no RLS recommendations, hardcoded secrets, exposed fields, dependency vulnerabilities, or static-code findings. It still identifies `submitLead` and `turnstileConfig` as low-severity publicly reachable functions. This is intentional for a public contact form: `submitLead` now has a caller check, HMAC form credential, mandatory Turnstile, hostname allowlist, duplicate guard, and rate limiting; `turnstileConfig` is read-only and returns a public site key plus short-lived credential.

### GitHub/Firebase application

- Upgraded vulnerable production dependencies, including Next.js, Firebase Admin/Functions, OpenAI, and Zod.
- Upgraded Firebase CLI and Vitest to remove critical/high vulnerabilities from development tooling.
- Forced the Firebase dependency graph onto patched `@grpc/grpc-js` 1.14.7.
- Migrated Zod record schemas to the Zod 4 key/value signature without weakening validation.
- Preserved existing tenant authorization, private Storage paths, signed public-content URLs, private cache headers, server/Admin-SDK-only mutation paths, Hebrew/RTL behavior, and user interface.

Dependency audit improvement:

- Before: 32 production findings (2 critical, 13 high, 17 moderate).
- After: 15 production findings (0 critical, 0 high, 15 moderate).
- Full tree after compatible fixes: 22 moderate findings, all in transitive Google/Firebase/ESLint tooling chains. npm offers only incompatible/downgrade paths for the remaining set; they require a separately reviewed dependency cycle rather than `--force`.

## Verification evidence

Passed:

- Base44 security tests: 3/3.
- Base44 lint and Vite production build.
- Repository typecheck.
- Core tests: 156/156.
- Functions tests: 265/265.
- Web tests: 60/60.
- Automation policy tests: 57/57.
- Backup/restore-tooling tests: 63/63.
- Total automated tests passed on the clean PR branch: 601.
- Repository lint: 0 errors (104 pre-existing warnings).
- Next.js production build and CSP hash synchronization: 21/21 routes.

Not completed in this environment:

- Firestore/Storage behavioral rules suite (73 tests): the local Firestore emulator cannot create its Java loopback selector on this Windows host. The first run also confirmed the tests are emulator-dependent rather than production-facing.
- Live backup freshness checks: `gcloud` is not installed on this host, so the read-only Firestore export, Storage Transfer, and watchdog checks could not run.
- Current restore drill: requires an explicit non-production GCP target and `gcloud`. The repository guard correctly refuses production as a restore target. Historical documentation records a successful isolated restore on 2026-08-31 (487/487 documents), but that is not current evidence.
- Two-account end-to-end cross-client test: cannot be claimed until the emulator/E2E environment is available and both identities are exercised.

## Data isolation and file security assessment

- Firestore and Storage rules are deny-by-default for writes from clients.
- Client reads require active organization membership plus matching customer/project scope; internal notes and business profiles remain staff-only.
- Discovery uploads bind organization, project, field, and uploader UID; MIME type and size limits are enforced in Storage rules.
- Staff-only artifacts and backend-generated documents are not directly writable by customers.
- Signed URLs are short-lived and generated only after server-side authorization.
- The static rules tests pass, but runtime proof is blocked on the emulator issue above; therefore isolation is not marked production-verified.

## Backups, retention, and Firebase decision

- The existing Firebase/GCP design already provides daily Firestore exports, weekly media transfer, object versioning, 90-day backup retention, watchdog monitoring, delete protection, and guarded isolated-restore tooling.
- Firebase is necessary for the GitHub PageLoom OS because it is the application's current authentication, database, Functions, Hosting, and private file platform. No migration or new Firebase project is justified.
- No Firebase configuration was changed during this audit.

## Remaining release gates

1. Install/use a supported JDK 21 environment and run the 73 Firestore/Storage behavioral tests plus customer lifecycle E2E tests.
2. Install/authenticate Google Cloud CLI with the PageLoom business account and run the three read-only freshness checks.
3. Run a current isolated restore drill, verify document/object counts and hashes, and remove the temporary target after evidence is recorded.
4. Execute two-client cross-account tests covering direct URL changes, API calls, downloads, previews, and uploads.
5. Review the 22 remaining moderate transitive findings and upgrade when upstream-compatible versions exist.
6. Obtain explicit owner approval before any production deployment or merge.

## Deployment readiness

**Status: BLOCKED — code checks green, operational security evidence incomplete.**

The branch and pull request are suitable for review. They must not be merged or deployed until all release gates above are evidenced.
