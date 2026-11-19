// H2: every deployed function must run as a dedicated, least-privilege service account - never the
// project's default compute account, which holds roles/editor. This reads the real exported
// function definitions (their deploy-time __endpoint manifest), so a new function added without a
// serviceAccount, or an existing one moved to the wrong account, fails here before it can deploy.
import { readFileSync } from "node:fs";
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

// The grant script is the single source of the accounts' real permissions. Guard it statically -
// the script itself is never run by tests (it is production-changing and approval-gated).
describe("scripts/iam H2 grant/rollback stay least-privilege (H2)", () => {
  const read = (name: string) => readFileSync(new URL(`../../scripts/iam/${name}`, import.meta.url), "utf8");
  const stripComments = (text: string) => text.split("\n").filter((line) => !line.trimStart().startsWith("#"));
  const script = read("h2-grant.sh");
  const common = read("h2-common.sh");
  const rollback = read("h2-rollback.sh");
  const grantCode = stripComments(script).join("\n");
  const commonLines = stripComments(common);
  const commonCode = commonLines.join("\n");
  const rollbackCode = stripComments(rollback).join("\n");
  // Everything phase 2 can do = the grant script plus the shared binding list it sources.
  const code = `${grantCode}\n${commonCode}`;
  const commands = [...stripComments(script), ...commonLines];

  it("uses LF line endings in every script (a CRLF copy breaks bash on Linux/CI)", () => {
    for (const [name, text] of [["h2-grant.sh", script], ["h2-common.sh", common], ["h2-rollback.sh", rollback]]) {
      expect(text, name).not.toContain("\r");
    }
  });

  it("never grants a broad or escalation-capable role", () => {
    for (const role of [
      "roles/editor", "roles/owner", "roles/viewer", "roles/storage.admin", "roles/storage.objectAdmin",
      "roles/datastore.owner", "roles/firebase.admin", "roles/firebaseauth.admin", "roles/secretmanager.admin",
      "roles/iam.serviceAccountUser", "roles/iam.serviceAccountAdmin", "roles/iam.securityAdmin",
      "roles/run.admin", "roles/run.developer", "roles/cloudbuild.builds.editor",
    ]) {
      expect(code, role).not.toMatch(new RegExp(`${role.replace(/\./g, "\\.")}\\b`));
    }
  });

  it("the grant only adds bindings - never removes, deletes or disables anything", () => {
    expect(grantCode).toMatch(/^h2_bindings add$/m);
    expect(grantCode).not.toMatch(/h2_bindings remove|remove-iam-policy-binding|set-iam-policy|\bdelete\b|\bdisable\b/);
    // The shared list is verb-parameterised; it must only ever accept add|remove, and never
    // hard-code a removal, a full policy overwrite, or a delete.
    expect(commonCode).toContain("case \"$verb\" in add) exec_fn=run ;; remove) exec_fn=run_tolerant ;;");
    expect(commonCode).not.toMatch(/remove-iam-policy-binding|set-iam-policy|\bdelete\b|\bdisable\b/);
  });

  it("the rollback removes exactly the shared list, and never deletes the custom role or accounts", () => {
    expect(rollbackCode).toMatch(/^\s+h2_bindings remove$/m);
    expect(rollbackCode).not.toMatch(/roles delete|service-accounts delete|set-iam-policy/);
    // Its only grant is restoring Editor on the compute account in the phase4 emergency path.
    const grants = rollbackCode.split("\n").filter((line) => line.includes("add-iam-policy-binding"));
    expect(grants).toHaveLength(1);
    expect(grants[0]).toContain('--member="serviceAccount:$COMPUTE_SA" --role=roles/editor');
  });

  it("never touches the existing compute, App Engine or backup accounts", () => {
    expect(code).not.toMatch(/-compute@developer|@appspot\.gserviceaccount\.com|pageloom-backup@/);
  });

  it("limits every Firestore grant to the main (default) database", () => {
    expect(commonCode).toContain('resource.name==\\"projects/${PROJECT}/databases/(default)\\"');
    expect(code).not.toMatch(/--role=roles\/datastore\.user[^\n]*--condition=None/);
    const unconditioned = commands.filter((line) => line.includes("roles/datastore.user") && !line.includes("DEFAULT_DB_CONDITION"));
    expect(unconditioned).toEqual([]);
  });

  it("gives api only the Auth permissions the code calls", () => {
    expect(code).toContain("--permissions=firebaseauth.users.get,firebaseauth.users.update,firebaseauth.users.sendEmail");
    expect(code).not.toMatch(/firebaseauth\.(users\.delete|configs\.)/);
  });

  // Character classes built from numeric code points so this file stays pure ASCII (a literal
  // bidi character in the source would itself be invisible and unreviewable).
  const range = (from: number, to: number) => `${String.fromCharCode(from)}-${String.fromCharCode(to)}`;
  const HEBREW = new RegExp(`[${range(0x0590, 0x05ff)}]`);
  // C0 controls, LRM/RLM, LRE..RLO embeddings/overrides, LRI..PDI isolates.
  const INVISIBLE = new RegExp(`[${range(0x00, 0x1f)}${range(0x200e, 0x200f)}${range(0x202a, 0x202e)}${range(0x2066, 0x2069)}]`);

  it("creates exactly the three H2 accounts, with Hebrew names within GCP limits and English IDs", () => {
    // create_sa <id> "<displayName>" \  (newline)  "<description>"
    const accounts = [...script.matchAll(/^create_sa (\S+) "([^"]+)" \\\n\s+"([^"]+)"$/gm)].map(([, id, displayName, description]) => ({ id, displayName, description }));
    expect(accounts.map((a) => a.id)).toEqual(["pageloom-api", "pageloom-agents", "pageloom-workers"]);
    for (const { id, displayName, description } of accounts) {
      expect(id, id).toMatch(/^[a-z][-a-z0-9]{4,28}[a-z0-9]$/); // GCP service-account ID format
      expect(Buffer.byteLength(displayName, "utf8"), `${id} displayName bytes`).toBeLessThanOrEqual(100);
      expect(Buffer.byteLength(description, "utf8"), `${id} description bytes`).toBeLessThanOrEqual(256);
      expect(HEBREW.test(displayName + description), `${id} has Hebrew text`).toBe(true);
      // No invisible bidi/control characters - they render unpredictably and hide edits.
      expect(INVISIBLE.test(displayName + description), `${id} bidi/control chars`).toBe(false);
    }
  });

  it("grants Cloud Run / Cloud Build to nobody (option A: the agents' gcp tool fails closed)", () => {
    expect(code).not.toMatch(/roles\/(run|cloudbuild)\./);
  });
});
