# PageLoom Company Workflow Engine

The workflow engine is the only component authorized to create project-agent tasks or change a project's workflow state. Agents produce evidence; they never start themselves or advance the project directly.

## Event flow

1. An authenticated API operation, system trigger, scheduler, or completed orchestrator task writes an immutable event to `organizations/{organizationId}/workflowEvents/{idempotencyKey}`.
2. `processWorkflowEvent` claims the event transactionally.
3. The engine validates the event against the current stage, accumulated facts, entry conditions, retry budget, and approval policy.
4. One Firestore transaction updates the workflow instance and project projection, appends history and logs, creates notifications, and queues the required agents.
5. Completed stage tasks emit the next business event only after every required agent for the same workflow attempt has completed.

The completion event uses a deterministic key derived from project, stage, attempt, and outcome. Concurrent final task updates therefore converge on one event document, and Firebase retry delivery cannot advance a stage twice.

Duplicate event delivery is safe because the event document ID is its idempotency key and processed events are terminal.

## Storage model

- `workflowInstances/{projectId}`: current execution state, facts, responsible agents, timeout, retry attempt, next stage, and blocked reason.
- `workflowEvents/{idempotencyKey}`: immutable event input plus its processing outcome.
- `workflowHistory/{id}`: append-only transition history.
- `workflowLogs/{id}`: operational decisions, ignored events, rollbacks, retries, and blocks.
- `projects/{projectId}`: denormalized CEO-facing projection used by the real-time timeline.

## Failure behavior

- `QAFailed` rolls the project back to Development.
- `AssetsMissing` rolls any downstream production stage back to Assets.
- `ApprovalRejected` rolls back to the responsible stage supplied by the approval decision, defaulting safely to UI Design.
- `AgentTaskFailed` and `StageTimedOut` retry the current stage using its configured attempt limit and backoff.
- An exhausted retry budget blocks the workflow and notifies the CEO. A human can emit `ManualRetryRequested` after resolving the cause.
- Stale or failed agent tasks are recovered by replacement, never by changing the original document back to queued. This preserves Firestore trigger semantics and an immutable attempt lineage. Exhausted tasks enter the dead-letter queue for owner review.

## Security and authority

Browser clients cannot write workflow state directly. The workflow event endpoint requires an organization owner, administrator, or operator. CEO and customer approvals are represented as verified events; approval-gated stages do not advance from agent completion alone.
