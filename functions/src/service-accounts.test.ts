// H2: every deployed function must run as a dedicated, least-privilege service account - never the
// project's default compute account, which holds roles/editor. This reads the real exported
// function definitions (their deploy-time __endpoint manifest), so a new function added without a
// serviceAccount, or an existing one moved to the wrong account, fails here before it can deploy.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as functions from "./index.js";
import { params } from "./config.js";

// PageLoom OS was retired on 2026-11-19: this codebase exports no functions any more (see index.test.ts).
// The per-function service-account guard for the two deployed backup functions lives in
// backup-functions/src/service-accounts.test.ts.
describe("function runtime service accounts (H2)", () => {
  it("the retired codebase exports no deployable function", () => {
    const endpoints = Object.values(functions).filter((value) => value && typeof value === "function" && "__endpoint" in value);
    expect(endpoints).toEqual([]);
  });

  const defaultOf = (param: unknown) => (param as { options?: { default?: string } }).options?.default;
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
  const invokers = read("h2-grant-invokers.sh");
  const grantCode = stripComments(script).join("\n");
  const commonLines = stripComments(common);
  const commonCode = commonLines.join("\n");
  const rollbackCode = stripComments(rollback).join("\n");
  const invokersCode = stripComments(invokers).join("\n");
  // Everything phases 2/2b can do = the grant scripts plus the shared lists they source.
  const code = `${grantCode}\n${invokersCode}\n${commonCode}`;
  const commands = [...stripComments(script), ...commonLines];

  it("uses LF line endings in every script (a CRLF copy breaks bash on Linux/CI)", () => {
    for (const [name, text] of [["h2-grant.sh", script], ["h2-common.sh", common], ["h2-rollback.sh", rollback], ["h2-grant-invokers.sh", invokers]]) {
      expect(text, name).not.toContain("\r");
    }
  });

  it("phase 2b grants run.invoker only per trigger SERVICE, only to that trigger's own account", () => {
    // Exactly the 4 Firestore-triggered services, each mapped to the account its function runs as.
    const list = common.match(/^H2_EVENT_INVOKERS=\(\n([\s\S]*?)\n\)$/m)?.[1] ?? "";
    const entries = [...list.matchAll(/"([a-z]+):\$([A-Z_]+)"/g)].map(([, service, sa]) => `${service}:${sa}`);
    expect(entries).toEqual([
      "executeagenttask:AGENTS_SA",
      "processworkflowevent:WORKERS_SA",
      "initializeprojectworkflow:WORKERS_SA",
      "handleworkflowtaskresult:WORKERS_SA",
    ]);
    // run.invoker only ever appears on a `gcloud run services` binding - never project-wide,
    // and api (public HTTP, invoked by allUsers) never gets it.
    // Exactly one occurrence in all phase 2/2b code: the per-service command in h2_invokers. Any
    // other use (e.g. via project_role, which would make it project-wide) is a second occurrence.
    const invokerLines = code.split("\n").filter((line) => line.includes("roles/run.invoker"));
    expect(invokerLines).toHaveLength(1);
    expect(invokerLines[0]).toMatch(/^\s+--member="serviceAccount:\$sa" --role=roles\/run\.invoker$/);
    expect(commonCode).toMatch(/gcloud run services "\$\{verb\}-iam-policy-binding" "\$service" --region="\$REGION"[^\n]*\\\n\s+--member="serviceAccount:\$sa" --role=roles\/run\.invoker/);
    expect(list).not.toMatch(/API_SA|api:/);
  });

  it("phase 2b only adds; the phase 2 rollback also removes the invokers", () => {
    expect(invokersCode).toMatch(/^h2_invokers add$/m);
    expect(invokersCode).not.toMatch(/h2_invokers remove|h2_bindings|remove-iam-policy-binding|\bdelete\b|\bdisable\b/);
    expect(rollbackCode).toMatch(/^\s+h2_invokers remove$/m);
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

  it("grants no Cloud Run management or Cloud Build role (option A: the agents' gcp tool fails closed)", () => {
    // The only Cloud Run role anywhere is the per-service invoker above - it lets a trigger call
    // its own function, nothing more (no deploy, no image change, no traffic change).
    const runRoles = [...code.matchAll(/roles\/run\.[a-zA-Z]+/g)].map(([role]) => role);
    expect(new Set(runRoles)).toEqual(new Set(["roles/run.invoker"]));
    expect(code).not.toMatch(/roles\/cloudbuild\./);
  });
});
