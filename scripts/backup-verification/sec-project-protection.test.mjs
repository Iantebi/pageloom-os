// Drives scripts/ops/sec-project-protection.sh against a STUB gcloud (state kept in flag files).
// No real cloud call is possible. Proves: dry runs change nothing, the lien stage verifies itself,
// and the vault stage refuses to run without billing or over an existing project.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isolatedEnv, assertStubResolves } from "./lib/test-sandbox.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "ops", "sec-project-protection.sh");

// Flags: lien (production lien), vault (vault project exists).
const STUB = `#!/usr/bin/env bash
echo "$*" >> "$STUB_DIR/calls"
case "$*" in
  "--version") echo stub ;;
  "config get-value account") echo protect-test@example.invalid ;;
  "projects describe pageloom-os-production"*) echo pageloom-os-production ;;
  "projects describe pageloom-backup-vault"*) [[ -f "$STUB_DIR/vault" ]] && echo pageloom-backup-vault || exit 1 ;;
  "alpha resource-manager liens list --project=pageloom-os-production"*) [[ -f "$STUB_DIR/lien" ]] && printf 'liens/1\\tpageloom-protection\\n' ;;
  "alpha resource-manager liens list"*) ;;
  "alpha resource-manager liens create --project=pageloom-os-production"*) touch "$STUB_DIR/lien" ;;
  "alpha resource-manager liens delete"*) rm -f "$STUB_DIR/lien" ;;
  "firestore databases describe"*) echo "DELETE_PROTECTION_ENABLED POINT_IN_TIME_RECOVERY_DISABLED" ;;
  "storage buckets describe"*) echo "2592000 False 604800 True" ;;
  *) echo "stub: unexpected gcloud $*" >&2; exit 99 ;;
esac
`;

function sandbox(flags = []) {
  const dir = mkdtempSync(join(tmpdir(), "protect-test-"));
  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "bin", "gcloud"), STUB.replace(/\r/g, ""));
  chmodSync(join(dir, "bin", "gcloud"), 0o755);
  for (const f of flags) writeFileSync(join(dir, f), "");
  assertStubResolves(dir, isolatedEnv(dir));
  return dir;
}
function protect(dir, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn("bash", [SCRIPT, ...args], { env: isolatedEnv(dir, { TZ: "UTC", ...env }) });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    child.on("close", (code) => resolve({ code, out, calls: existsSync(join(dir, "calls")) ? readFileSync(join(dir, "calls"), "utf8") : "" }));
  });
}
const inBackupWindow = new Date().getUTCHours() === 0;
const MUTATING = /liens (create|delete)|projects create|billing|services enable|buckets (create|update|add-iam)|transfer jobs/;

test("status reports a missing lien and a missing vault", async () => {
  const dir = sandbox();
  const r = await protect(dir, ["status"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /MISSING: no lien/);
  assert.match(r.out, /MISSING: no vault/);
  assert.doesNotMatch(r.calls, MUTATING);
  rmSync(dir, { recursive: true, force: true });
});

test("dry runs print the plan and change nothing", async () => {
  const dir = sandbox();
  for (const [stage, env] of [["lien", {}], ["rollback-lien", {}], ["vault", { BILLING_ACCOUNT: "000000-000000-000000" }]]) {
    const r = await protect(dir, [stage], env);
    assert.equal(r.code, 0, `${stage}: ${r.out}`);
    assert.match(r.out, /DRY RUN/);
  }
  const calls = readFileSync(join(dir, "calls"), "utf8");
  assert.doesNotMatch(calls, MUTATING);
  assert.ok(!existsSync(join(dir, "lien")));
  rmSync(dir, { recursive: true, force: true });
});

test("lien --execute adds the lien, verifies it, and is idempotent; rollback removes it", { skip: inBackupWindow }, async () => {
  const dir = sandbox();
  const r = await protect(dir, ["lien", "--execute"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /PASS: lien present/);
  assert.match(r.calls, /--restrictions=resourcemanager.projects.delete/);
  const again = await protect(dir, ["lien", "--execute"]);
  assert.match(again.out, /already present/);
  assert.equal((await protect(dir, ["rollback-lien", "--execute"])).code, 0);
  assert.ok(!existsSync(join(dir, "lien")));
  rmSync(dir, { recursive: true, force: true });
});

test("vault refuses without BILLING_ACCOUNT and over an existing vault project", { skip: inBackupWindow }, async () => {
  const dir = sandbox(["vault"]);
  const noBilling = await protect(dir, ["vault", "--execute"]);
  assert.equal(noBilling.code, 1);
  assert.match(noBilling.out, /set BILLING_ACCOUNT/);
  const exists = await protect(dir, ["vault", "--execute"], { BILLING_ACCOUNT: "000000-000000-000000" });
  assert.equal(exists.code, 1);
  assert.match(exists.out, /already exists/);
  assert.doesNotMatch(readFileSync(join(dir, "calls"), "utf8"), MUTATING);
  rmSync(dir, { recursive: true, force: true });
});

test("vault refuses a lifecycle that would delete before the retention ends", async () => {
  const dir = sandbox();
  const r = await protect(dir, ["vault"], { BILLING_ACCOUNT: "000000-000000-000000", VAULT_DELETE_AFTER_DAYS: "30" });
  assert.equal(r.code, 1);
  assert.match(r.out, /lifecycle delete must be later/);
  rmSync(dir, { recursive: true, force: true });
});
