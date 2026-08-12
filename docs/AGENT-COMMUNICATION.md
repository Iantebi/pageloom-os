# Agent communication protocol

Agents never call one another directly. The central orchestrator is the sole communication and execution authority.

## Task lifecycle

1. The human CEO records an agreed deal after the phone close. The API atomically creates the project, close evidence, journey event, and first post-close task. Internal jobs and agent chats remain separate from customer communication.
2. Firestore records a queued task with an agent, objective, locale, priority, context, and creator.
3. The task trigger transactionally claims the task and the orchestrator loads only organization-scoped context.
4. The model router sends every task to Google AI Studio's supported `gemini-pro-latest` alias. If that primary provider is unavailable or fails, the orchestrator records a fallback event and retries once with OpenAI GPT through the Responses API.
5. The agent returns a schema-validated result: summary, deliverables, files, risks, metrics, delegated tasks, and requested tools.
6. The orchestrator stores artifacts, usage, model route, and activity. Delegations become bounded child tasks with parent and depth metadata.
7. Safe read/draft operations pass through the tool gateway. External messages, spending, deployment, destructive changes, and production writes become approval records.
8. Only the organization owner acting as CEO may approve or reject the action. Approved tools execute once using the stored idempotency key and append an audit record.

## Invariants

- Every record is scoped to an organization and every API request verifies Firebase ID tokens and membership.
- Agent output is untrusted until local validation and capability checks succeed.
- Agents cannot read secrets, bypass approvals, contact a customer directly, or claim an external side effect without connector evidence.
- Delegation is limited to depth four and twelve child tasks per result.
- Chat uses the same task pipeline; it is not a privileged model backdoor.
- Locale travels with every task. Hebrew output and UI use `he` and RTL; English uses `en` and LTR.
- Failures and fallbacks are visible as activity events and never rewritten as success.

## Live state

The dashboard subscribes to organization task, project, approval, activity, and usage collections. This shows real execution state rather than simulated animation. KPI, revenue, cost, analytics, and API-usage views are projections derived from those records.
