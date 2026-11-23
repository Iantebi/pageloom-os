// Drives scripts/ops/sec-restore-drill.sh end to end against a STUB gcloud (first on PATH) and a
// local fake Firestore REST server - no real cloud call is possible. Proves the guards, the cleanup
// path and the behaviour on every failure the drill can hit.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isolatedEnv, assertStubResolves } from "./lib/test-sandbox.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "ops", "sec-restore-drill.sh");
const DB = "pageloom-restore-drill-20261124";

// Stub gcloud: state lives in $STUB_DIR (dbs = "name createTime" lines), every call is logged.
const STUB = `#!/usr/bin/env bash
echo "$*" >> "$STUB_DIR/calls"
touch "$STUB_DIR/dbs"
case "$*" in
  "--version") echo stub ;;
  "config get-value account") echo drill-test@example.invalid ;;
  "projects describe"*) echo pageloom-os-production ;;
  "auth print-access-token") echo fake-token ;;
  "firestore databases list"*createTime*) cat "$STUB_DIR/dbs" ;;
  "firestore databases list"*) cut -d' ' -f1 "$STUB_DIR/dbs" ;;
  "firestore databases describe"*) db="$(sed -E 's/.*--database=([^ ]+).*/\\1/' <<<"$*")"; cat "$STUB_DIR/prot-$db" 2>/dev/null || echo DELETE_PROTECTION_DISABLED ;;
  "firestore databases create"*) db="$(sed -E 's/.*--database=([^ ]+).*/\\1/' <<<"$*")"; echo "$db $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$STUB_DIR/dbs" ;;
  "firestore databases delete"*) db="$(sed -E 's/.*--database=([^ ]+).*/\\1/' <<<"$*")"
     [[ -n "\${STUB_DELETE_FAIL:-}" ]] && { echo "ERROR: (stub) delete failed" >&2; exit 1; }
     [[ -n "\${STUB_DELETE_NOOP:-}" ]] && exit 0
     grep -v "^$db " "$STUB_DIR/dbs" > "$STUB_DIR/dbs.new" || true; mv "$STUB_DIR/dbs.new" "$STUB_DIR/dbs" ;;
  "firestore import"*) [[ -n "\${STUB_IMPORT_FAIL:-}" ]] && { echo "ERROR: (stub) import failed" >&2; exit 1; }; exit 0 ;;
  *) echo "stub: unexpected gcloud $*" >&2; exit 99 ;;
esac
`;

let server, apiBase, nonEmpty = false;
before(async () => {
  server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url.includes(":listCollectionIds")) return res.end(JSON.stringify(nonEmpty && !/documents\/x/.test(req.url) ? { collectionIds: ["x"] } : {}));
    if (nonEmpty && /\/documents\/x\?/.test(req.url)) return res.end(JSON.stringify({ documents: [{ name: `projects/p/databases/${DB}/documents/x/1`, createTime: "2026-11-24T00:00:00Z", updateTime: "2026-11-24T00:00:00Z", fields: {} }] }));
    res.end("{}");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  apiBase = `http://127.0.0.1:${server.address().port}/v1`;
});
after(() => server.close());

function sandbox({ dbs = [], prot = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "drill-test-"));
  const bin = join(dir, "bin");
  spawnSync("mkdir", ["-p", bin]);
  writeFileSync(join(bin, "gcloud"), STUB.replace(/\r/g, ""));
  chmodSync(join(bin, "gcloud"), 0o755);
  writeFileSync(join(dir, "dbs"), dbs.map((d) => `${d.name} ${d.created ?? new Date().toISOString()}`).join("\n") + (dbs.length ? "\n" : ""));
  for (const [db, state] of Object.entries(prot)) writeFileSync(join(dir, `prot-${db}`), `${state}\n`);
  assertStubResolves(dir, isolatedEnv(dir));
  return dir;
}
// Async on purpose: the fake Firestore server lives in this process, so a blocking spawnSync would
// deadlock the verifier the script starts.
function drill(dir, stage, { execute = true, env = {}, db = DB } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", [SCRIPT, stage, ...(execute ? ["--execute"] : [])], {
      env: isolatedEnv(dir, { DRILL_DB: db, EXPORT_DATE: "2026-11-23", DRILL_POLL_SECONDS: "0", FIRESTORE_API_BASE: apiBase, ...env }),
    });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`timeout: ${stage}
${out}`)); }, 60_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      const calls = existsSync(join(dir, "calls")) ? readFileSync(join(dir, "calls"), "utf8") : "";
      resolve({ code, out, calls, dbs: readFileSync(join(dir, "dbs"), "utf8") });
    });
  });
}
const cleanup = (dir) => rmSync(dir, { recursive: true, force: true });

test("refuses (default) and malformed names before any create/import/delete call", async () => {
  for (const db of ["(default)", "pageloom-prod", "pageloom-restore-drill-2026"]) {
    const dir = sandbox();
    for (const stage of ["create", "import", "delete"]) {
      const r = await drill(dir, stage, { db });
      assert.notEqual(r.code, 0);
      assert.doesNotMatch(r.calls, /databases (create|delete)|firestore import/);
    }
    cleanup(dir);
  }
});

test("dry run never calls a mutating command", async () => {
  const dir = sandbox({ dbs: [{ name: DB }] });
  for (const stage of ["create", "import", "delete"]) {
    const r = await drill(dir, stage, { execute: false });
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /DRY RUN/);
    // A dry run may not even reach gcloud (no calls file at all) - never a mutating call.
    assert.doesNotMatch(r.calls, /databases (create|delete)|firestore import/);
  }
  assert.match(readFileSync(join(dir, "dbs"), "utf8"), new RegExp(DB));
  cleanup(dir);
});

test("create refuses an existing database", async () => {
  const dir = sandbox({ dbs: [{ name: DB }] });
  const r = await drill(dir, "create");
  assert.equal(r.code, 1);
  assert.match(r.out, /already exists/);
  assert.doesNotMatch(r.calls, /databases create/);
  cleanup(dir);
});

test("happy path: create -> import -> delete leaves no drill database", async () => {
  const dir = sandbox({ dbs: [{ name: "(default)" }] });
  const created = await drill(dir, "create");
  assert.equal(created.code, 0, created.out);
  assert.match(created.dbs, new RegExp(DB));
  const imported = await drill(dir, "import");
  assert.equal(imported.code, 0, imported.out);
  assert.match(imported.calls, /firestore import gs:\/\/pageloom-os-production-backups\/firestore\/2026-11-23 --database=pageloom-restore-drill-20261124/);
  const del = await drill(dir, "delete");
  assert.equal(del.code, 0, del.out);
  assert.doesNotMatch(del.dbs, new RegExp(DB));
  assert.match(del.dbs, /\(default\)/);
  cleanup(dir);
});

test("import refuses a database that is not empty", async () => {
  nonEmpty = true;
  const dir = sandbox({ dbs: [{ name: DB }] });
  const r = await drill(dir, "import");
  nonEmpty = false;
  assert.equal(r.code, 1);
  assert.match(r.out, /not empty/);
  assert.doesNotMatch(r.calls, /firestore import/);
  cleanup(dir);
});

test("failed import exits 6 and tells the operator to delete the partial copy", async () => {
  const dir = sandbox({ dbs: [{ name: DB }] });
  const r = await drill(dir, "import", { env: { STUB_IMPORT_FAIL: "1" } });
  assert.equal(r.code, 6);
  assert.match(r.out, /PARTIAL production data.*delete --execute/s);
  cleanup(dir);
});

test("failed delete exits 4 and the database is reported as still existing", async () => {
  const dir = sandbox({ dbs: [{ name: DB }] });
  const r = await drill(dir, "delete", { env: { STUB_DELETE_FAIL: "1" } });
  assert.equal(r.code, 4);
  assert.match(r.out, /DELETE FAILED/);
  assert.match(r.dbs, new RegExp(DB));
  cleanup(dir);
});

test("delete that reports success but leaves the database listed exits 5 (never a false 'deleted')", async () => {
  const dir = sandbox({ dbs: [{ name: DB }] });
  const r = await drill(dir, "delete", { env: { STUB_DELETE_NOOP: "1" } });
  assert.equal(r.code, 5);
  assert.match(r.out, /still listed/);
  cleanup(dir);
});

test("delete refuses a database with delete protection (a real database, not a drill copy)", async () => {
  const dir = sandbox({ dbs: [{ name: DB }], prot: { [DB]: "DELETE_PROTECTION_ENABLED" } });
  const r = await drill(dir, "delete");
  assert.equal(r.code, 1);
  assert.match(r.out, /delete protection/);
  assert.doesNotMatch(r.calls, /databases delete/);
  cleanup(dir);
});

test("delete of a database that does not exist is a no-op success", async () => {
  const dir = sandbox();
  const r = await drill(dir, "delete");
  assert.equal(r.code, 0);
  assert.match(r.out, /nothing to delete/);
  assert.doesNotMatch(r.calls, /databases delete/);
  cleanup(dir);
});

test("status flags drill databases older than 24h as LEFTOVER, never touches anything", async () => {
  const dir = sandbox({ dbs: [{ name: "(default)" }, { name: "pageloom-restore-drill-20260903", created: "2026-09-03T06:23:31Z" }, { name: DB }] });
  const r = await drill(dir, "status");
  assert.equal(r.code, 0);
  assert.match(r.out, /LEFTOVER: pageloom-restore-drill-20260903/);
  assert.match(r.out, new RegExp(`drill database present: ${DB}`));
  assert.doesNotMatch(r.calls, /databases (create|delete)|firestore import/);
  cleanup(dir);
});

test("verify fails closed (exit 3) when the API cannot be read, and points to cleanup", async () => {
  const dir = sandbox({ dbs: [{ name: DB }] });
  const r = await drill(dir, "verify", { env: { FIRESTORE_API_BASE: "http://127.0.0.1:9/v1" } });
  assert.equal(r.code, 3);
  assert.match(r.out, /delete .* today/);
  cleanup(dir);
});
