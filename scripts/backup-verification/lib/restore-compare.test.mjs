import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalFields, evaluateRestore } from "./restore-compare.mjs";

const START = "2026-11-23T00:30:04Z";
const END = "2026-11-23T00:31:02Z";
const BEFORE = "2026-11-20T10:00:00Z";
const DURING = "2026-11-23T00:30:30Z";
const AFTER = "2026-11-23T09:00:00Z";
const f = (v) => ({ v: { stringValue: v } });

function scenario({ docs = 100, mutate = () => {}, exportDocs, importOp } = {}) {
  const production = new Map();
  const restored = new Map();
  for (let i = 0; i < docs; i += 1) {
    const path = `organizations/o/items/d${i}`;
    production.set(path, { createTime: BEFORE, updateTime: BEFORE, fields: f(`x${i}`) });
    restored.set(path, { fields: f(`x${i}`) });
  }
  mutate({ production, restored });
  const exported = exportDocs ?? restored.size;
  return {
    exportOp: { state: "SUCCESSFUL", startTime: START, endTime: END, documents: exported },
    importOp: importOp === undefined ? { state: "SUCCESSFUL", documents: exported } : importOp,
    production, restored,
  };
}

test("perfect restore passes", () => {
  const r = evaluateRestore(scenario());
  assert.equal(r.verdict, "PASS", r.reasons.join("; "));
  assert.equal(r.stats.verifiedIdentical, 100);
});

test("partial restore (documents missing) fails even when counts are made to match", () => {
  const r = evaluateRestore(scenario({ mutate: ({ restored }) => { restored.delete("organizations/o/items/d1"); restored.delete("organizations/o/items/d2"); } , exportDocs: 98 }));
  assert.equal(r.verdict, "FAIL");
  assert.match(r.reasons.join(), /2 documents that existed before the export are missing/);
});

test("restore with fewer documents than the export reports fails", () => {
  const r = evaluateRestore(scenario({ exportDocs: 120 }));
  assert.equal(r.verdict, "FAIL");
  assert.match(r.reasons.join(), /restored 100 documents but the export reports 120/);
});

test("import operation not SUCCESSFUL, or missing, fails", () => {
  assert.equal(evaluateRestore(scenario({ importOp: { state: "FAILED", documents: 100 } })).verdict, "FAIL");
  assert.equal(evaluateRestore(scenario({ importOp: { state: "PROCESSING", documents: 40 } })).verdict, "FAIL");
  assert.equal(evaluateRestore(scenario({ importOp: null })).verdict, "FAIL");
});

test("import reporting a different count than the export fails", () => {
  const r = evaluateRestore(scenario({ importOp: { state: "SUCCESSFUL", documents: 99 } }));
  assert.equal(r.verdict, "FAIL");
});

test("unchanged document with different content fails", () => {
  const r = evaluateRestore(scenario({ mutate: ({ restored }) => restored.set("organizations/o/items/d5", { fields: f("tampered") }) }));
  assert.equal(r.verdict, "FAIL");
  assert.equal(r.stats.fieldMismatch, 1);
});

test("documents changed during the export window: either version accepted, but must exist", () => {
  const ok = evaluateRestore(scenario({ mutate: ({ production }) => {
    for (const i of [1, 2, 3]) production.get(`organizations/o/items/d${i}`).updateTime = DURING;
    production.get("organizations/o/items/d1").fields = f("new-version");
  } }));
  assert.equal(ok.verdict, "PASS", ok.reasons.join("; "));
  assert.equal(ok.stats.changedDuringExportPresent, 3);
  const missing = evaluateRestore(scenario({ exportDocs: 99, mutate: ({ production, restored }) => {
    production.get("organizations/o/items/d1").updateTime = DURING; restored.delete("organizations/o/items/d1");
  } }));
  assert.equal(missing.verdict, "FAIL");
});

test("documents changed after the export: content not compared, presence required", () => {
  const r = evaluateRestore(scenario({ mutate: ({ production }) => {
    const d = production.get("organizations/o/items/d7"); d.updateTime = AFTER; d.fields = f("edited later");
  } }));
  assert.equal(r.verdict, "PASS", r.reasons.join("; "));
  assert.equal(r.stats.changedAfterExportPresent, 1);
});

test("documents created during or after the export are not required", () => {
  const r = evaluateRestore(scenario({ mutate: ({ production }) => {
    production.set("organizations/o/items/new-during", { createTime: DURING, updateTime: DURING, fields: f("n") });
    production.set("organizations/o/items/new-after", { createTime: AFTER, updateTime: AFTER, fields: f("n") });
  } }));
  assert.equal(r.verdict, "PASS", r.reasons.join("; "));
  assert.equal(r.stats.createdDuringExport, 1);
  assert.equal(r.stats.createdAfterExport, 1);
});

test("documents deleted from production since the export are allowed and counted", () => {
  const r = evaluateRestore(scenario({ mutate: ({ production }) => production.delete("organizations/o/items/d9") }));
  assert.equal(r.verdict, "PASS", r.reasons.join("; "));
  assert.equal(r.stats.deletedSinceExport, 1);
});

test("too little verifiable data is INCONCLUSIVE, never PASS", () => {
  const r = evaluateRestore(scenario({ mutate: ({ production }) => {
    for (let i = 0; i < 40; i += 1) production.get(`organizations/o/items/d${i}`).updateTime = AFTER;
  } }));
  assert.equal(r.verdict, "INCONCLUSIVE");
  assert.equal(r.stats.verifiedRatio, 0.6);
});

test("empty restore fails", () => {
  const r = evaluateRestore({ exportOp: { state: "SUCCESSFUL", startTime: START, endTime: END, documents: 0 }, importOp: { state: "SUCCESSFUL", documents: 0 }, production: new Map(), restored: new Map() });
  assert.equal(r.verdict, "FAIL");
});

test("field comparison ignores key order but not values or types", () => {
  assert.deepEqual(JSON.stringify(canonicalFields({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: 2 } })), JSON.stringify({ a: { c: 2, d: [1, { y: 2, z: 1 }] }, b: 1 }));
  const r = evaluateRestore(scenario({ mutate: ({ production, restored }) => {
    production.get("organizations/o/items/d3").fields = { a: { integerValue: "1" }, b: { stringValue: "x" } };
    restored.set("organizations/o/items/d3", { fields: { b: { stringValue: "x" }, a: { integerValue: "1" } } });
    production.get("organizations/o/items/d4").fields = { a: { integerValue: "1" } };
    restored.set("organizations/o/items/d4", { fields: { a: { doubleValue: 1 } } });
  } }));
  assert.equal(r.stats.fieldMismatch, 1);
});

test("invalid timestamps fail closed", () => {
  assert.throws(() => evaluateRestore({ exportOp: { state: "SUCCESSFUL", startTime: "nope", endTime: END, documents: 1 }, importOp: null, production: new Map(), restored: new Map() }));
});
