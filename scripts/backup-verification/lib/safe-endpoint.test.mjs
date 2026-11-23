import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertOverrideIsLoopback } from "./safe-endpoint.mjs";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");

test("API overrides are accepted only for loopback test servers", () => {
  for (const ok of ["http://127.0.0.1:8080/v1", "http://localhost:1/x", "http://[::1]:9/v3"]) assert.equal(assertOverrideIsLoopback("X", ok), ok);
  for (const bad of ["https://evil.example/v1", "http://127.0.0.1.evil.example/v1", "https://firestore.googleapis.com.attacker.io/", "not a url"]) assert.throws(() => assertOverrideIsLoopback("X", bad));
});

test("each CLI refuses a non-loopback override before sending the token anywhere", () => {
  const cases = [
    ["check-backup-iam.mjs", ["current"], { TROUBLESHOOTER_URL: "https://attacker.example/v3" }],
    ["verify-restore.mjs", ["empty"], { FIRESTORE_API_BASE: "https://attacker.example/v1", PROJECT: "p", DRILL_DB: "pageloom-restore-drill-20261124" }],
    ["verify-scheduled-backup.mjs", ["2026-11-24"], { API_BASES: JSON.stringify({ logging: "https://attacker.example", firestore: "http://127.0.0.1:1", storage: "http://127.0.0.1:1" }) }],
  ];
  for (const [cli, args, env] of cases) {
    const r = spawnSync(process.execPath, [join(HERE, cli), ...args], { encoding: "utf8", env: { ...process.env, TOKEN: "secret-token-value", ...env } });
    assert.equal(r.status, 3, `${cli}: ${r.stderr}`);
    assert.match(r.stderr, /refusing to send the access token/);
    assert.doesNotMatch(r.stdout + r.stderr, /secret-token-value/);
  }
});
