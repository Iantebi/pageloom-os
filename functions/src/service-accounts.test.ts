// H2: every deployed function must run as a dedicated, least-privilege service account - never the
// project's default compute account, which holds roles/editor. This reads the real exported
// function definitions (their deploy-time __endpoint manifest), so a new function added without a
// serviceAccount, or an existing one moved to the wrong account, fails here before it can deploy.
import { describe, expect, it } from "vitest";
import * as functions from "./index.js";
import { params } from "./config.js";

type Endpoint = { serviceAccountEmail?: unknown };
const endpoints = Object.entries(functions)
  .filter(([, value]) => value && typeof value === "function" && "__endpoint" in value)
  .map(([name, value]) => [name, (value as unknown as { __endpoint: Endpoint }).__endpoint] as const);

const EXPECTED: Record<string, unknown> = {
  api: params.apiServiceAccount,
  executeAgentTask: params.agentsServiceAccount,
  processWorkflowEvent: params.workersServiceAccount,
  initializeProjectWorkflow: params.workersServiceAccount,
  handleWorkflowTaskResult: params.workersServiceAccount,
  monitorWorkflowTimeouts: params.workersServiceAccount,
  recoverAgentQueue: params.workersServiceAccount,
  monitorBusinessRisks: params.workersServiceAccount,
  backupFreshnessWatchdog: params.workersServiceAccount,
  dailyCeoReport: params.workersServiceAccount,
  dailyFirestoreBackup: params.backupServiceAccount,
};

describe("function runtime service accounts (H2)", () => {
  it("covers exactly the exported functions", () => {
    expect(endpoints.map(([name]) => name).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.keys(EXPECTED))("%s runs as its dedicated service account", (name) => {
    const endpoint = endpoints.find(([n]) => n === name)?.[1];
    expect(endpoint?.serviceAccountEmail).toBe(EXPECTED[name]);
  });

  // Param .value() is empty outside the Functions runtime, so assert on each param's deploy-time
  // default - the address that is actually deployed unless an env override is set.
  const defaultOf = (param: unknown) => (param as { options?: { default?: string } }).options?.default;

  it("no function falls back to the default compute account", () => {
    for (const [name, endpoint] of endpoints) {
      const email = defaultOf(endpoint.serviceAccountEmail);
      expect(email, name).toMatch(/^pageloom-[a-z]+@pageloom-os-production\.iam\.gserviceaccount\.com$/);
      expect(email, name).not.toMatch(/-compute@developer\.gserviceaccount\.com|@appspot\.gserviceaccount\.com/);
    }
  });

  it("api, agents and workers each get their own account", () => {
    expect(defaultOf(params.apiServiceAccount)).toBe("pageloom-api@pageloom-os-production.iam.gserviceaccount.com");
    expect(defaultOf(params.agentsServiceAccount)).toBe("pageloom-agents@pageloom-os-production.iam.gserviceaccount.com");
    expect(defaultOf(params.workersServiceAccount)).toBe("pageloom-workers@pageloom-os-production.iam.gserviceaccount.com");
  });
});
