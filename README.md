# PageLoom OS

PageLoom OS is an enterprise AI operating system for a human-led web agency. Twenty-two non-overlapping specialist agents work only through one central orchestrator. The CEO conducts sales calls, closes every deal, and is the sole authority for protected actions; AI project work begins only after the close is recorded.

## Technology

- Next.js 16, React 19, TypeScript, and Tailwind CSS
- Firebase Hosting, Authentication, Functions, Firestore, and Cloud Storage
- Provider-independent AI execution with a manual owner-operated task queue for launch; future OpenAI and Gemini adapters remain dormant
- Google Workspace, Business Profile, Maps, Places, Analytics, Search Console, Tag Manager, GitHub, Stripe, PayPal, WhatsApp, Resend, Twilio, CRM, Make, n8n, Cloud Build, and Cloud Run adapters

No CMS or page-builder runtime is used. Websites are delivered as native React/Next.js applications on Firebase and Google Cloud. Customers never interact directly with AI, and outbound communication is executed only after CEO approval.

## Repository

- `apps/web` — bilingual control plane and real-time dashboard
- `functions` — authenticated API, event-driven orchestrator, tools, schedules, and webhooks
- `packages/core` — shared contracts, agent definitions, prompts, and model routing
- `docs` — architecture, communication, security, and operations runbooks
- `prompts` and `templates` — prompt governance and reusable delivery assets

## Local development

Requirements: Node.js 22, a Firebase project, and the Firebase CLI.

1. Copy `.env.example` to `apps/web/.env.local` and add the browser-safe Firebase values.
2. Keep `AI_EXECUTION_MODE=manual`. No AI credential is required for the official launch workflow.
3. Existing OpenAI and Gemini secrets may remain in Secret Manager for future API mode, but are not invoked in manual mode.
4. Run `npm.cmd install`, then `npm.cmd run dev`.

The dashboard is served at `http://localhost:3000`. Use `npm.cmd run check` before merging.

## Production

Create `.firebaserc` from `.firebaserc.example`, configure Firebase Functions secrets as described in [operations](docs/OPERATIONS.md), and run `npm.cmd run deploy`. Hosting serves the static Next.js control plane; `/api/**` is routed to the authenticated Cloud Function.

See [architecture](docs/ARCHITECTURE.md), [agent communication](docs/AGENT-COMMUNICATION.md), [security](docs/SECURITY.md), and [operations](docs/OPERATIONS.md).
