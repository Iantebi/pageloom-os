import { test } from "node:test";
import assert from "node:assert/strict";
import { makeClient, run } from "./verify-restore.mjs";

const BASE = "https://fs.test/v1";
const P = "pageloom-os-production";
const SOURCE = "gs://pageloom-os-production-backups/firestore/2026-11-23";
const BEFORE = "2026-11-20T00:00:00Z";

/** Minimal fake of the Firestore REST surface the verifier uses. dbs: { db: { "col/doc": {...} | "MISSING" } } */
function fakeFetch(dbs, ops, { failOn } = {}) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push(`${init.method ?? "GET"} ${url}`);
    if (failOn && url.includes(failOn)) return new Response("{}", { status: 403 });
    const m = url.match(/\/databases\/([^/]+)\/(documents|operations)(.*)$/);
    const db = decodeURIComponent(m[1]);
    if (m[2] === "operations") return Response.json({ operations: ops[db] ?? [] });
    const docs = dbs[db] ?? {};
    let rest = m[3].split("?")[0];
    if (rest.endsWith(":listCollectionIds")) {
      const parent = rest.replace(":listCollectionIds", "").replace(/^\//, "");
      const depth = parent ? parent.split("/").length : 0;
      const ids = new Set(Object.keys(docs).filter((p) => p.startsWith(parent ? `${parent}/` : "") && p.split("/").length === depth + 2).map((p) => p.split("/")[depth]));
      return Response.json({ collectionIds: [...ids] });
    }
    const col = decodeURIComponent(rest.replace(/^\//, ""));
    const depth = col.split("/").length;
    const all = Object.entries(docs).filter(([p]) => p.startsWith(`${col}/`) && p.split("/").length === depth + 1);
    const token = Number(new URL(url).searchParams.get("pageToken") ?? 0);
    const page = all.slice(token, token + 2); // tiny pages to exercise pagination
    const documents = page.map(([p, d]) => (d === "MISSING" ? { name: `projects/${P}/databases/${db}/documents/${p}` } : { name: `projects/${P}/databases/${db}/documents/${p}`, createTime: BEFORE, updateTime: BEFORE, fields: d }));
    return Response.json({ documents, ...(token + 2 < all.length ? { nextPageToken: String(token + 2) } : {}) });
  };
  return { impl, calls };
}

const docs = {
  "organizations/a": { n: { stringValue: "a" } },
  "organizations/b": { n: { stringValue: "b" } },
  "organizations/c": { n: { stringValue: "c" } },
  "organizations/ghost": "MISSING", // parent never written...
  "organizations/ghost/answers/q1": { v: { stringValue: "1" } }, // ...but its subcollection is real
  "organizations/a/answers/q1": { v: { stringValue: "2" } },
};
const exportOp = { metadata: { "@type": "type.googleapis.com/google.firestore.admin.v1.ExportDocumentsMetadata", outputUriPrefix: SOURCE, operationState: "SUCCESSFUL", startTime: "2026-11-23T00:30:04Z", endTime: "2026-11-23T00:31:02Z", progressDocuments: { completedWork: "5" } } };
const importOp = (state = "SUCCESSFUL", n = "5") => ({ metadata: { "@type": "type.googleapis.com/google.firestore.admin.v1.ImportDocumentsMetadata", inputUriPrefix: SOURCE, operationState: state, startTime: "2026-11-24T10:00:00Z", progressDocuments: { completedWork: n } } });

test("walk counts real documents only and follows subcollections of missing parents across pages", async () => {
  const { impl } = fakeFetch({ "(default)": docs }, {});
  const client = makeClient({ project: P, token: "t", base: BASE, fetchImpl: impl });
  const found = await client.walk("(default)");
  assert.equal(found.size, 5);
  assert.ok(found.has("organizations/ghost/answers/q1"));
  assert.ok(!found.has("organizations/ghost"));
});

test("full verification passes for an exact restore", async () => {
  const { impl } = fakeFetch({ "(default)": docs, "pageloom-restore-drill-20261124": docs }, { "(default)": [exportOp], "pageloom-restore-drill-20261124": [importOp()] });
  const client = makeClient({ project: P, token: "t", base: BASE, fetchImpl: impl });
  const { code, report } = await run({ mode: "full", project: P, drillDb: "pageloom-restore-drill-20261124", source: SOURCE, client, minVerifiedRatio: 0.5 });
  assert.equal(report.verdict, "PASS", report.reasons.join("; "));
  assert.equal(code, 0);
});

test("a restore missing the subcollection under a missing parent FAILS", async () => {
  const partial = { ...docs }; delete partial["organizations/ghost/answers/q1"]; delete partial["organizations/ghost"];
  const { impl } = fakeFetch({ "(default)": docs, "pageloom-restore-drill-20261124": partial }, { "(default)": [exportOp], "pageloom-restore-drill-20261124": [importOp("SUCCESSFUL", "4")] });
  const client = makeClient({ project: P, token: "t", base: BASE, fetchImpl: impl });
  const { code, report } = await run({ mode: "full", project: P, drillDb: "pageloom-restore-drill-20261124", source: SOURCE, client, minVerifiedRatio: 0.5 });
  assert.equal(report.verdict, "FAIL");
  assert.equal(code, 1);
});

test("an import still running is not a PASS", async () => {
  const { impl } = fakeFetch({ "(default)": docs, "pageloom-restore-drill-20261124": docs }, { "(default)": [exportOp], "pageloom-restore-drill-20261124": [importOp("PROCESSING", "3")] });
  const client = makeClient({ project: P, token: "t", base: BASE, fetchImpl: impl });
  const { report } = await run({ mode: "full", project: P, drillDb: "pageloom-restore-drill-20261124", source: SOURCE, client, minVerifiedRatio: 0.5 });
  assert.equal(report.verdict, "FAIL");
});

test("empty check: 0 for an empty database, non-zero otherwise", async () => {
  const { impl } = fakeFetch({ "pageloom-restore-drill-20261124": {} , "pageloom-restore-drill-20261125": { "x/1": { a: { stringValue: "1" } } } }, {});
  const client = makeClient({ project: P, token: "t", base: BASE, fetchImpl: impl });
  assert.equal((await run({ mode: "empty", drillDb: "pageloom-restore-drill-20261124", client })).code, 0);
  assert.equal((await run({ mode: "empty", drillDb: "pageloom-restore-drill-20261125", client })).code, 1);
});

test("refuses the production database and malformed targets before any API call", async () => {
  const { impl, calls } = fakeFetch({}, {});
  const client = makeClient({ project: P, token: "t", base: BASE, fetchImpl: impl });
  for (const drillDb of ["(default)", "pageloom-prod", "", undefined, "pageloom-restore-drill-2026112"]) {
    await assert.rejects(run({ mode: "empty", drillDb, client }), /refusing target database/);
  }
  assert.equal(calls.length, 0);
});

test("API errors fail closed (throw), never a verdict", async () => {
  const { impl } = fakeFetch({ "(default)": docs }, { "(default)": [exportOp] }, { failOn: "pageloom-restore-drill" });
  const client = makeClient({ project: P, token: "t", base: BASE, fetchImpl: impl });
  await assert.rejects(run({ mode: "full", project: P, drillDb: "pageloom-restore-drill-20261124", source: SOURCE, client }), /HTTP 403/);
});

test("an export older than the operation history fails closed", async () => {
  const { impl } = fakeFetch({ "(default)": docs }, { "(default)": [] });
  const client = makeClient({ project: P, token: "t", base: BASE, fetchImpl: impl });
  await assert.rejects(run({ mode: "full", project: P, drillDb: "pageloom-restore-drill-20261124", source: SOURCE, client }), /no export operation found/);
});
