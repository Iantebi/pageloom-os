#!/usr/bin/env node
/**
 * Read-only: checks the backup IAM matrix for one phase with the Policy Troubleshooter API.
 *   node check-backup-iam.mjs current|after-grant|after-exporter|after-bucket|after-workers
 * Exit 0 = every check as expected, 1 = at least one not, 3 = API/input error (fail closed).
 * Env: TOKEN (OAuth access token). TROUBLESHOOTER_URL overrides the endpoint (tests only).
 * Note: the troubleshooter reads the current IAM policy immediately; enforcement can lag by a few
 * minutes, which is why the stage script also waits and then runs a real call (see verify).
 */
import { fileURLToPath } from "node:url";
import { PROJECT, checksFor, evaluateCheck, evaluatePhase, troubleshootBody } from "./lib/backup-iam-matrix.mjs";

const DEFAULT_URL = "https://policytroubleshooter.googleapis.com/v3/iam:troubleshoot";

export async function checkPhase(phase, { token, url = DEFAULT_URL, fetchImpl = fetch }) {
  const results = [];
  for (const check of checksFor(phase)) {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": PROJECT, "Content-Type": "application/json" },
      body: JSON.stringify(troubleshootBody(check)),
    });
    if (!res.ok) throw new Error(`troubleshooter HTTP ${res.status} for ${check.id}`);
    results.push(evaluateCheck(check, await res.json()));
  }
  return { phase, results, ...evaluatePhase(results) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const phase = process.argv[2];
  try {
    if (!process.env.TOKEN) throw new Error("TOKEN is required");
    const out = await checkPhase(phase, { token: process.env.TOKEN, ...(process.env.TROUBLESHOOTER_URL ? { url: process.env.TROUBLESHOOTER_URL } : {}) });
    for (const r of out.results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.id.padEnd(44)} ${r.state.padEnd(14)} via [${r.roles.join(", ")}]${r.ok ? "" : `  <- ${r.problems.join("; ")}`}`);
    console.log(out.ok ? `  IAM phase "${phase}": all ${out.total} checks as expected` : `  IAM phase "${phase}": ${out.failed.length} of ${out.total} checks FAILED`);
    process.exit(out.ok ? 0 : 1);
  } catch (error) {
    console.error(`ERROR (fail closed): ${error.message}`);
    process.exit(3);
  }
}
