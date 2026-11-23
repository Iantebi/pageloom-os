/**
 * Isolation for the tests that drive the PRODUCTION ops scripts (scripts/ops/*.sh) with --execute.
 * Those tests must never be able to reach real gcloud, even on a machine that is signed in:
 *   1. the stub gcloud dir goes first on PATH (with the platform's own delimiter);
 *   2. CLOUDSDK_CONFIG points to an EMPTY directory and every credential variable is removed, so even
 *      if real gcloud were found it has no account - and the scripts' preflight aborts without one;
 *   3. assertStubResolves() checks, inside the same bash + env, that `gcloud` IS the stub before any
 *      test runs a script - if not, the test fails instead of executing anything.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { delimiter, join } from "node:path";

const CREDENTIAL_VARS = ["GOOGLE_APPLICATION_CREDENTIALS", "CLOUDSDK_AUTH_ACCESS_TOKEN_FILE", "CLOUDSDK_AUTH_ACCESS_TOKEN", "CLOUDSDK_CORE_ACCOUNT", "CLOUDSDK_CORE_PROJECT", "TOKEN"];

export function isolatedEnv(dir, extra = {}) {
  const config = join(dir, "empty-gcloud-config");
  mkdirSync(config, { recursive: true });
  const env = { ...process.env };
  for (const v of CREDENTIAL_VARS) delete env[v];
  return { ...env, PATH: `${join(dir, "bin")}${delimiter}${process.env.PATH}`, CLOUDSDK_CONFIG: config, CLOUDSDK_PYTHON: "", STUB_DIR: dir, ...extra };
}

export function assertStubResolves(dir, env) {
  const r = spawnSync("bash", ["-c", "command -v gcloud && gcloud --version"], { encoding: "utf8", env });
  const resolved = (r.stdout ?? "").split(/\r?\n/)[0];
  const stubDir = join(dir, "bin").replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_m, d) => `/${d.toLowerCase()}`).toLowerCase();
  const ok = r.status === 0 && /^stub$/m.test(r.stdout ?? "") && resolved.replace(/\\/g, "/").toLowerCase().includes(stubDir.split("/").slice(-2).join("/"));
  if (!ok) throw new Error(`SAFETY: gcloud does not resolve to the test stub (got "${resolved}") - refusing to run production scripts in this test`);
}
