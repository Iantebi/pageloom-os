# Operations runbook

## Initial setup

1. Create Firebase web and Google Cloud projects, enable Authentication (Google provider), Firestore, Storage, Functions, Hosting, Secret Manager, Cloud Build, and the required Google APIs.
2. Copy `.firebaserc.example` to `.firebaserc` and set the Firebase project alias. Copy `.env.example` to `apps/web/.env.local` and enter only browser-safe Firebase configuration.
3. Import secrets with `firebase functions:secrets:set NAME`. Configure the Google AI Studio key as `GEMINI_API_KEY` for the primary `gemini-pro-latest` runtime. Reuse the existing OpenAI key for the `OPENAI_API_KEY` fallback; do not generate or expose another key. Configure only the connector secrets that will be enabled.
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

The authenticated `GET /api/operations/{organizationId}/health` endpoint produces a deterministic health score and signal counts for failed or stale tasks, blocked or timed-out workflows, overdue approvals, and usage without configured pricing. Only owners, administrators, and operators may read it.

## Queue recovery and dead letters

`recoverAgentQueue` runs every five minutes. A running task with a lease older than 15 minutes, a queued task unclaimed for 30 minutes, or a failed task is atomically retired and replaced by a new task document so the Firestore create trigger executes again. Recovery preserves the original task, project, stage, constraints, and lineage. Once `maxAttempts` is exhausted, the task is cancelled and copied to `deadLetters/{taskId}`. Only the organization owner can explicitly retry an open dead letter through `POST /api/operations/{organizationId}/dead-letters/{deadLetterId}/retry`; this creates a fresh task and retains the incident record.

## AI budget enforcement

Set `aiBudgetUsd` on each organization. Before model inference, the orchestrator subtracts recorded usage and conservative reservations for concurrently running tasks. Work that cannot fit inside the remaining ceiling is moved to `awaiting_approval` with `approvalReason: ai_budget`; it is never silently executed. Model routing also rejects providers whose maximum estimated request cost exceeds the remaining budget. Configure every active model rate card so recorded spend is accurate.
