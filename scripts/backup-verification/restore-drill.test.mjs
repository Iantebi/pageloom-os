import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRestorePlan } from "./restore-drill.mjs";
import { PRODUCTION_PROJECT_ID } from "./lib/project-guard.mjs";

const PRODUCTION_VARIANTS = [PRODUCTION_PROJECT_ID, "PAGELOOM-OS-PRODUCTION", "  pageloom-os-production  ", "pageloom-os-production\n", undefined, "", null];

for (const variant of PRODUCTION_VARIANTS) {
  test(`refuses to build a restore plan targeting production: ${JSON.stringify(variant)}`, () => {
    assert.throws(() => buildRestorePlan({ targetProject: variant, exportDate: "2026-09-01" }));
  });
}

test("refuses a malformed export date even for a valid non-production target", () => {
  assert.throws(() => buildRestorePlan({ targetProject: "pageloom-restore-drill", exportDate: "09-01-2026" }));
  assert.throws(() => buildRestorePlan({ targetProject: "pageloom-restore-drill", exportDate: undefined }));
  assert.throws(() => buildRestorePlan({ targetProject: "pageloom-restore-drill", exportDate: "" }));
});

test("builds a full plan for a valid non-production target without executing anything", () => {
  const plan = buildRestorePlan({
    targetProject: "pageloom-restore-drill",
    exportDate: "2026-09-01",
    database: "drill-db",
    sourceBucket: "pageloom-os-production-backups",
  });
  assert.equal(plan.target, "pageloom-restore-drill");
  assert.equal(plan.sourceUri, "gs://pageloom-os-production-backups/firestore/2026-09-01");
  assert.ok(plan.verifyDescriptor.args.includes("pageloom-restore-drill"));
  assert.ok(plan.importDescriptor.args.includes("--project=pageloom-restore-drill"));
  assert.ok(plan.importDescriptor.args.includes("--database=drill-db"));
  assert.ok(plan.importDescriptor.args.includes(plan.sourceUri));
});

test("the plan's cleanup descriptor deletes the drill database and is never itself executed by buildRestorePlan", () => {
  const plan = buildRestorePlan({ targetProject: "pageloom-restore-drill", exportDate: "2026-09-01", database: "drill-db" });
  assert.deepEqual(plan.cleanupDescriptor.args, [
    "firestore", "databases", "delete", "--database=drill-db", "--project=pageloom-restore-drill", "--quiet", "--format=json",
  ]);
});

test("defaults database and sourceBucket when not given", () => {
  const plan = buildRestorePlan({ targetProject: "pageloom-restore-drill", exportDate: "2026-09-01" });
  assert.equal(plan.sourceUri, "gs://pageloom-os-production-backups/firestore/2026-09-01");
  assert.ok(plan.importDescriptor.args.includes("--database=pageloom-restore-drill"));
});
