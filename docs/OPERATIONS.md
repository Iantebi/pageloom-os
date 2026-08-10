# Operations runbook

## Initial setup

1. Create Firebase web and Google Cloud projects, enable Authentication (Google provider), Firestore, Storage, Functions, Hosting, Secret Manager, Cloud Build, and the required Google APIs.
2. Copy `.firebaserc.example` to `.firebaserc` and set the Firebase project alias. Copy `.env.example` to `apps/web/.env.local` and enter only browser-safe Firebase configuration.
3. Import secrets with `firebase functions:secrets:set NAME`. Configure the Google AI Studio key as `GEMINI_API_KEY` for the primary `gemini-2.5-pro` runtime. Reuse the existing OpenAI key for the `OPENAI_API_KEY` fallback; do not generate or expose another key. Configure only the connector secrets that will be enabled.
4. Create `organizations/{orgId}` and `organizations/{orgId}/members/{uid}` with `uid`, `role: "owner"`, and display metadata using an authenticated administration process.
5. Add current model rate cards at `system/modelPricing/{provider}_{model}`. Until configured, usage is recorded with `pricingStatus: "unconfigured"` and cost is not guessed.
6. Run `npm.cmd run check`, test with Firebase Emulator Suite, then deploy using `npm.cmd run deploy`.

## Google and business integrations

For Workspace delegation, set `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON` and `GOOGLE_WORKSPACE_SUBJECT`, authorize only the scopes used by PageLoom, and restrict the service account. Enable Gmail, Calendar, Drive, Docs, Sheets, Analytics Data, Search Console, Business Profile, Tag Manager, Maps, and Places APIs as needed. Configure Stripe webhook delivery to `/api/webhooks/stripe`. CRM, GitHub, Make, n8n, WhatsApp, Resend, Twilio, PayPal, Cloud Build, and Cloud Run remain disabled until their corresponding secret or configuration is present.

## Release gates

- Typecheck, unit tests, production builds, lint, dependency audit, Firebase Rules tests, and tenant-isolation tests pass.
- A reviewer validates agent prompts, tool grants, approval boundaries, rate cards, budgets, and data retention.
- Staging verifies provider fallback, task retry/idempotency, webhook replay, Hebrew RTL, accessibility, and rollback.
- Production has alerting for task failure, queue age, approval latency, auth failures, connector errors, model spend, API usage, gross margin, and revenue anomalies.

## Incident response

Disable the affected connector secret or function first, preserve activity/audit records, rotate exposed credentials, revoke sessions when identity is involved, and replay only tasks with verified idempotency state. Never mark an external action successful without connector evidence.

## Service objectives

Track orchestration success and latency, queue age, model/provider fallback, token and API cost, task retry/dead-letter rate, approval wait time, integration availability, deployment health, project margin, conversion, and recurring revenue.
