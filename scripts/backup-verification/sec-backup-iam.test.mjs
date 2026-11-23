// Drives scripts/ops/sec-backup-iam-least-privilege.sh against a STUB gcloud that simulates the IAM
// policy in files, and a local fake Policy Troubleshooter that answers from that simulated policy.
// No real cloud call is possible. Proves the stage guards: nothing is removed unless the proof passes.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "ops", "sec-backup-iam-least-privilege.sh");

// Simulated policy = flag files: iea (importExportAdmin), exp (new exporter binding), objadmin, wds (workers datastore.user).
const STUB = `#!/usr/bin/env bash
echo "$*" >> "$STUB_DIR/calls"
case "$*" in
  "--version") echo stub ;;
  "config get-value account") echo iam-test@example.invalid ;;
  "projects describe"*) echo pageloom-os-production ;;
  "auth print-access-token") echo fake-token ;;
  "iam roles describe"*) [[ -f "$STUB_DIR/role" ]] || exit 1 ;;
  "iam roles create"*) touch "$STUB_DIR/role" ;;
  *"add-iam-policy-binding"*"pageloomFirestoreExporter"*) touch "$STUB_DIR/exp" ;;
  *"remove-iam-policy-binding"*"pageloomFirestoreExporter"*) rm -f "$STUB_DIR/exp" ;;
  *"add-iam-policy-binding"*"importExportAdmin"*) touch "$STUB_DIR/iea" ;;
  *"remove-iam-policy-binding"*"importExportAdmin"*) rm -f "$STUB_DIR/iea" ;;
  *"buckets remove-iam-policy-binding"*"objectAdmin"*) rm -f "$STUB_DIR/objadmin" ;;
  *"buckets add-iam-policy-binding"*"objectAdmin"*) touch "$STUB_DIR/objadmin" ;;
  *"remove-iam-policy-binding"*"datastore.user"*) rm -f "$STUB_DIR/wds" ;;
  *"add-iam-policy-binding"*"datastore.user"*) touch "$STUB_DIR/wds" ;;
  *) echo "stub: unexpected gcloud $*" >&2; exit 99 ;;
esac
`;

let server, url;
let brokenExporter = false; // simulate a new role that does NOT grant export (e.g. wrong condition)
before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => { body += d; });
    req.on("end", () => {
      const dir = new URL(req.url, "http://x").searchParams.get("dir");
      const has = (f) => existsSync(join(dir, f));
      const t = JSON.parse(body).accessTuple;
      const db = t.conditionContext?.resource?.name?.split("/").pop();
      let roles = ["some.role"];
      if (t.permission === "datastore.databases.export") roles = [has("iea") && "datastore.importExportAdmin", has("exp") && !brokenExporter && db === "(default)" && "projects/p/roles/pageloomFirestoreExporter"].filter(Boolean);
      else if (t.permission === "datastore.databases.import") roles = has("iea") ? ["datastore.importExportAdmin"] : [];
      else if (/storage\.objects\.(create|delete)/.test(t.permission) && t.principal.startsWith("pageloom-backup")) roles = has("objadmin") ? ["storage.objectAdmin"] : [];
      else if (t.permission === "datastore.entities.get" && t.principal.startsWith("pageloom-workers")) roles = has("wds") ? ["datastore.user"] : [];
      else if (t.permission === "datastore.entities.create") roles = ["pageloomBackupWriter"];
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ overallAccessState: roles.length ? "CAN_ACCESS" : "CANNOT_ACCESS", allowPolicyExplanation: { explainedPolicies: [{ bindingExplanations: roles.map((r) => ({ role: r.includes("/") ? r : `roles/${r}`, allowAccessState: "ALLOW_ACCESS_STATE_GRANTED" })) }] } }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${server.address().port}/v3/iam:troubleshoot`;
});
after(() => server.close());

function sandbox(flags = ["iea", "objadmin", "wds"]) {
  const dir = mkdtempSync(join(tmpdir(), "iam-test-"));
  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "bin", "gcloud"), STUB.replace(/\r/g, ""));
  chmodSync(join(dir, "bin", "gcloud"), 0o755);
  for (const f of flags) writeFileSync(join(dir, f), "");
  return dir;
}
function iam(dir, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn("bash", [SCRIPT, ...args], { env: { ...process.env, PATH: `${join(dir, "bin")}:${process.env.PATH}`, STUB_DIR: dir, TROUBLESHOOTER_URL: `${url}?dir=${encodeURIComponent(dir)}`, IAM_POLL_SECONDS: "0", CLOUDSDK_PYTHON: "", TZ: "UTC", ...env } });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    child.on("close", (code) => resolve({ code, out, calls: existsSync(join(dir, "calls")) ? readFileSync(join(dir, "calls"), "utf8") : "" }));
  });
}
const has = (dir, f) => existsSync(join(dir, f));
// The scripts refuse to change anything 00:00-01:00 UTC; tests that execute must not depend on the clock.
const inBackupWindow = new Date().getUTCHours() === 0;

test("check current passes on today's simulated policy, after-exporter fails", async () => {
  const dir = sandbox();
  assert.equal((await iam(dir, ["check", "current"])).code, 0);
  assert.equal((await iam(dir, ["check", "after-exporter"])).code, 1);
  rmSync(dir, { recursive: true, force: true });
});

test("exporter: happy path removes importExportAdmin only after the new role is proven", { skip: inBackupWindow }, async () => {
  const dir = sandbox();
  const r = await iam(dir, ["exporter", "--execute"]);
  assert.equal(r.code, 0, r.out);
  assert.ok(has(dir, "exp") && !has(dir, "iea"));
  const order = r.calls.split("\n");
  assert.ok(order.findIndex((l) => /add-iam-policy-binding.*pageloomFirestoreExporter/.test(l)) < order.findIndex((l) => /remove-iam-policy-binding.*importExportAdmin/.test(l)));
  assert.match(r.out, /IAM phase "after-exporter": all/);
  rmSync(dir, { recursive: true, force: true });
});

test("exporter: if the new role does not grant export, importExportAdmin is NOT removed", { skip: inBackupWindow }, async () => {
  brokenExporter = true;
  const dir = sandbox();
  const r = await iam(dir, ["exporter", "--execute"]);
  brokenExporter = false;
  assert.equal(r.code, 1);
  assert.match(r.out, /importExportAdmin was NOT removed/);
  assert.doesNotMatch(r.calls, /remove-iam-policy-binding.*importExportAdmin/);
  assert.ok(has(dir, "iea"), "export permission must still exist");
  rmSync(dir, { recursive: true, force: true });
});

test("stages refuse to start out of order (bucket before exporter) and change nothing", { skip: inBackupWindow }, async () => {
  const dir = sandbox();
  const r = await iam(dir, ["bucket", "--execute"]);
  assert.equal(r.code, 1);
  assert.doesNotMatch(r.calls, /remove-iam-policy-binding/);
  assert.ok(has(dir, "objadmin"));
  rmSync(dir, { recursive: true, force: true });
});

test("full sequence exporter -> bucket -> workers ends in the least-privilege matrix; rollback restores", { skip: inBackupWindow }, async () => {
  const dir = sandbox();
  for (const stage of ["exporter", "bucket", "workers"]) assert.equal((await iam(dir, [stage, "--execute"])).code, 0, stage);
  assert.equal((await iam(dir, ["check", "after-workers"])).code, 0);
  assert.ok(!has(dir, "iea") && !has(dir, "objadmin") && !has(dir, "wds") && has(dir, "exp"));
  for (const rb of ["rollback-workers", "rollback-bucket", "rollback-exporter"]) assert.equal((await iam(dir, [rb, "--execute"])).code, 0, rb);
  assert.equal((await iam(dir, ["check", "current"])).code, 0);
  rmSync(dir, { recursive: true, force: true });
});

test("dry run changes nothing, even when a precheck fails", async () => {
  const dir = sandbox();
  for (const stage of ["exporter", "bucket", "workers", "rollback-exporter"]) {
    const r = await iam(dir, [stage]);
    assert.equal(r.code, 0, `${stage}: ${r.out}`);
    assert.doesNotMatch(r.calls, /policy-binding|roles create|scheduler jobs run/);
  }
  assert.ok(has(dir, "iea") && has(dir, "objadmin") && has(dir, "wds") && !has(dir, "exp"));
  rmSync(dir, { recursive: true, force: true });
});

test("troubleshooter unreachable: the stage aborts before any change", { skip: inBackupWindow }, async () => {
  const dir = sandbox();
  const r = await iam(dir, ["exporter", "--execute"], { TROUBLESHOOTER_URL: "http://127.0.0.1:9/v3/iam:troubleshoot" });
  assert.equal(r.code, 1);
  assert.doesNotMatch(r.calls, /policy-binding|roles create/);
  rmSync(dir, { recursive: true, force: true });
});
