import { test } from "node:test";
import assert from "node:assert/strict";
import { BACKUP_SA, WORKERS_SA, checksFor, evaluateCheck, evaluatePhase, grantingRoles, troubleshootBody } from "./backup-iam-matrix.mjs";
import { checkPhase } from "../check-backup-iam.mjs";

const resp = (state, roles = []) => ({ overallAccessState: state, allowPolicyExplanation: { explainedPolicies: [{ bindingExplanations: [
  ...roles.map((r) => ({ role: r.includes("/") ? r : `roles/${r}`, allowAccessState: "ALLOW_ACCESS_STATE_GRANTED" })),
  { role: "roles/viewer", allowAccessState: "ALLOW_ACCESS_STATE_NOT_GRANTED" },
] }] } });

test("every phase keeps all permissions the two functions really use", () => {
  for (const phase of ["current", "after-grant", "after-exporter", "after-bucket", "after-workers"]) {
    const ids = checksFor(phase).map((c) => c.id);
    for (const needed of ["backup-writes-run-records", "backup-invoked-by-scheduler", "firestore-agent-writes-export-files", "watchdog-invoked-by-scheduler", "watchdog-lists-backup-bucket", "watchdog-reads-transfer-ops", "watchdog-reads-service-health", "backup-can-export-default-db"]) {
      assert.ok(ids.includes(needed), `${phase} misses ${needed}`);
    }
  }
});

test("later phases include the earlier removals (stages run in order)", () => {
  const ids = checksFor("after-workers").map((c) => c.id);
  for (const id of ["backup-cannot-import-default-db", "backup-cannot-export-other-dbs", "backup-cannot-write-backup-files", "watchdog-has-no-firestore"]) assert.ok(ids.includes(id));
  assert.throws(() => checksFor("nonsense"));
});

test("Firestore checks carry the database as condition context (conditions are evaluated)", () => {
  const exp = checksFor("after-exporter").find((c) => c.id === "backup-cannot-export-other-dbs");
  assert.deepEqual(troubleshootBody(exp).accessTuple.conditionContext.resource, { name: "projects/pageloom-os-production/databases/pageloom-restore-drill-00000000", service: "firestore.googleapis.com", type: "firestore.googleapis.com/Database" });
  assert.equal(troubleshootBody(exp).accessTuple.principal, BACKUP_SA);
});

test("export must be granted by the NEW role - and in after-exporter by nothing else", () => {
  const grant = checksFor("after-grant").find((c) => c.id === "backup-can-export-default-db");
  assert.equal(evaluateCheck(grant, resp("CAN_ACCESS", ["datastore.importExportAdmin"])).ok, false, "old role alone is not proof");
  assert.equal(evaluateCheck(grant, resp("CAN_ACCESS", ["datastore.importExportAdmin", "projects/pageloom-os-production/roles/pageloomFirestoreExporter"])).ok, true);
  const only = checksFor("after-exporter").find((c) => c.id === "backup-can-export-default-db");
  assert.equal(evaluateCheck(only, resp("CAN_ACCESS", ["datastore.importExportAdmin", "projects/x/roles/pageloomFirestoreExporter"])).ok, false);
  assert.equal(evaluateCheck(only, resp("CAN_ACCESS", ["projects/x/roles/pageloomFirestoreExporter"])).ok, true);
});

test("unknown / conditional / missing states fail closed", () => {
  const c = checksFor("current")[0];
  for (const state of ["UNKNOWN_CONDITIONAL", "UNKNOWN_INFO", undefined]) assert.equal(evaluateCheck(c, state ? resp(state) : {}).ok, false);
  const cannot = checksFor("after-workers").find((x) => x.id === "watchdog-has-no-firestore");
  assert.equal(cannot.principal, WORKERS_SA);
  assert.equal(evaluateCheck(cannot, resp("CANNOT_ACCESS")).ok, true);
  assert.equal(evaluateCheck(cannot, resp("CAN_ACCESS", ["datastore.user"])).ok, false);
});

test("grantingRoles reads only GRANTED bindings", () => {
  assert.deepEqual(grantingRoles(resp("CAN_ACCESS", ["run.invoker"])), ["run.invoker"]);
  assert.deepEqual(grantingRoles({}), []);
  assert.equal(evaluatePhase([{ ok: true }, { ok: false, id: "x" }]).ok, false);
});

test("checkPhase: API error fails closed; all-expected phase passes", async () => {
  await assert.rejects(checkPhase("current", { token: "t", url: "http://x", fetchImpl: async () => new Response("{}", { status: 403 }) }), /HTTP 403/);
  const answers = Object.fromEntries(checksFor("after-workers").map((c) => [`${c.principal}|${c.permission}|${c.context?.name ?? c.resource}`, c.expect === "CAN_ACCESS" ? resp("CAN_ACCESS", c.via ?? ["some.role"]) : resp("CANNOT_ACCESS")]));
  const fetchImpl = async (_u, init) => { const t = JSON.parse(init.body).accessTuple; return Response.json(answers[`${t.principal}|${t.permission}|${t.conditionContext?.resource?.name ?? t.fullResourceName}`]); };
  const out = await checkPhase("after-workers", { token: "t", url: "http://x", fetchImpl });
  assert.equal(out.ok, true, JSON.stringify(out.failed));
});

test("every phase keeps the Discovery gateway's own access and keeps backup accounts out of client files", () => {
  for (const phase of ["current", "after-grant", "after-exporter", "after-bucket", "after-workers"]) {
    const ids = checksFor(phase).map((c) => c.id);
    for (const b of ["pageloom-discovery-files", "pageloom-discovery-files-backup"]) {
      assert.ok(ids.includes(`discovery-gw-writes-${b}`) && ids.includes(`discovery-gw-reads-${b}`), `${phase}: gateway ${b}`);
      assert.ok(ids.includes(`pageloom-backup-cannot-read-${b}`) && ids.includes(`pageloom-workers-cannot-read-${b}`), `${phase}: isolation ${b}`);
    }
  }
});

test("checkPhase retries a rate limit (429) then succeeds; a 403 is never retried", async () => {
  const ok = (c) => resp(c.expect === "CAN_ACCESS" ? "CAN_ACCESS" : "CANNOT_ACCESS", c.via ?? ["some.role"]);
  const checks = checksFor("current");
  let calls = 0;
  const flaky = async (_u, init) => { calls += 1; if (calls === 2) return new Response("{}", { status: 429 }); const t = JSON.parse(init.body).accessTuple; return Response.json(ok(checks.find((c) => c.principal === t.principal && c.permission === t.permission && (c.context?.name ?? c.resource) === (t.conditionContext?.resource?.name ?? t.fullResourceName)))); };
  const out = await checkPhase("current", { token: "t", url: "http://x", fetchImpl: flaky, sleep: async () => {}, retryDelaysMs: [0, 0] });
  assert.equal(out.ok, true, JSON.stringify(out.failed));
  assert.equal(calls, checks.length + 1);
  let n = 0;
  await assert.rejects(checkPhase("current", { token: "t", url: "http://x", fetchImpl: async () => { n += 1; return new Response("{}", { status: 403 }); }, sleep: async () => {}, retryDelaysMs: [0, 0] }), /HTTP 403/);
  assert.equal(n, 1);
  let m = 0;
  await assert.rejects(checkPhase("current", { token: "t", url: "http://x", fetchImpl: async () => { m += 1; return new Response("{}", { status: 429 }); }, sleep: async () => {}, retryDelaysMs: [0, 0] }), /HTTP 429/);
  assert.equal(m, 3);
});
