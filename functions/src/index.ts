// PageLoom OS was retired on 2026-11-19. This codebase no longer defines ANY Cloud Function.
// The 9 OS functions (api, executeAgentTask, processWorkflowEvent, initializeProjectWorkflow,
// handleWorkflowTaskResult, monitorWorkflowTimeouts, recoverAgentQueue, monitorBusinessRisks,
// dailyCeoReport) were deleted from production and must never come back.
// The only deployed functions (dailyFirestoreBackup, backupFreshnessWatchdog) live in
// backup-functions/ - firebase.json deploys from there. Guarded by index.test.ts.
export {};
