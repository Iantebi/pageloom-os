# Security model

## Identity and tenancy

Firebase Authentication issues ID tokens. The API validates tokens with revocation checks and verifies the caller's organization membership and role. Firestore and Storage rules deny browser writes to operational data; privileged mutations run only through Admin SDK code. Paths and queries are organization-scoped.

## Secrets and providers

Production secrets live in Google Secret Manager through Firebase `defineSecret`; local secrets remain in ignored environment files. API keys are never returned to the browser, written to Firestore, logged, or placed in `NEXT_PUBLIC_` variables. Google Workspace uses delegated service-account credentials. Integration tokens should be separate production credentials with the narrowest available scopes and rotation schedules.

## Agent and tool safety

- Model responses use provider-side structured output and local Zod validation.
- The gateway applies per-operation agent allowlists, parameter schemas, approval requirements, and idempotency.
- Charging, refunds, price changes, email, WhatsApp, SMS, publication, production deployment, destructive changes, and automation activation require approval by the organization owner acting as CEO.
- Every execution stores a redacted audit result. Provider errors returned to users are generic.
- OpenAI safety identifiers are one-way hashes; raw user identifiers are not sent as safety IDs.
- Generated artifact paths are sanitized and confined to the organization's Storage prefix.

## Production controls

Enable Firebase App Check, organization MFA policy, Secret Manager rotation, Cloud Audit Logs, budget alerts, log-based anomaly alerts, retention rules, backup/PITR, and regional data controls before customer onboarding. Configure Google OAuth delegation and each connector with least privilege. Run dependency, rules, prompt-injection, tenant-isolation, and webhook-replay tests in CI.

App Check has application-side readiness: `apps/web/src/lib/firebase.ts` initializes a `ReCaptchaV3Provider` only when `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` is set, and stays fully inert otherwise. Turning this on for real still requires, in order: (1) registering a reCAPTCHA v3 key for the web app in the Firebase console (external, owner action, not part of this repo), (2) setting that key as `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` and deploying Hosting, (3) confirming valid App Check tokens are actually arriving on `api` requests, and only then (4) enabling `enforceAppCheck` on the `api` function and redeploying Functions. Do not skip straight to step 4 - enforcing before the client is verified to be sending tokens would reject all production traffic.

MFA/re-authentication review: every owner-only mutation already requires a fresh Firebase ID token (`authenticate` in `functions/src/auth.ts`) and the `owner` organization role (`requireCeo`), including production-release approval, dead-letter retry, fleet/infrastructure actions, and legal document publish-requests. There is currently no additional re-authentication-freshness check (e.g. a maximum age on the token's `auth_time`) in front of those specific actions, and Firebase-side MFA enrollment is an Authentication-console policy, not something this repository configures. Both remain open items for a deliberate, reviewed change rather than something to flip silently.

The repository intentionally contains no plaintext credentials. The existing OpenAI key remains local and must be imported into Firebase Secret Manager for deployment.
