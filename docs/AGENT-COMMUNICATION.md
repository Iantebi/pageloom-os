# Agent communication protocol

Agents never call one another directly. The central orchestrator is the sole communication and execution authority.

## Task lifecycle

1. The human CEO records an agreed deal after the phone close. The API atomically creates the project, close evidence, journey event, and first post-close task. Internal jobs and agent chats remain separate from customer communication.
2. Firestore records a queued task with an agent, objective, locale, priority, context, and creator.
3. The task trigger loads only organization-scoped context and prepares a provider-independent manual AI job. No model API is called.
4. The owner copies the prepared package from the Agents page, executes it in ChatGPT or Google AI Studio, and pastes the returned JSON into PageLoom.
5. The API requires owner authority and validates the full result contract plus every stage-required deliverable.
6. The orchestrator stores artifacts, completion provenance, and activity. Delegations become bounded child tasks, and the workflow resumes exactly as it would in future API mode.
7. Safe read/draft operations pass through the tool gateway. External messages, spending, deployment, destructive changes, and production writes become approval records.
8. Only the organization owner acting as CEO may approve or reject the action. Approved tools execute once using the stored idempotency key and append an audit record.

## Invariants

- Every record is scoped to an organization and every API request verifies Firebase ID tokens and membership.
- Agent output is untrusted until local validation and capability checks succeed.
- Agents cannot read secrets, bypass approvals, contact a customer directly, or claim an external side effect without connector evidence.
- Delegation is limited to depth four and twelve child tasks per result.
- Chat uses the same task pipeline; it is not a privileged model backdoor.
- Locale travels with every task. Hebrew output and UI use `he` and RTL; English uses `en` and LTR.
- Manual preparation and completion are visible as activity events and never rewritten as provider inference.

## Live state

The dashboard subscribes to organization task, project, approval, activity, and usage collections. This shows real execution state rather than simulated animation. KPI, revenue, cost, analytics, and API-usage views are projections derived from those records.
