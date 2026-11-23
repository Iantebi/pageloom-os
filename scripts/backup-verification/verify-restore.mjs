#!/usr/bin/env node
/**
 * Read-only REST side of the real restore drill (scripts/ops/sec-restore-drill.sh).
 *
 *   node verify-restore.mjs empty  -> exit 0 only if the target database holds no document at all
 *   node verify-restore.mjs full   -> PASS (0) / FAIL (1) / INCONCLUSIVE (2), see lib/restore-compare.mjs
 *   any API or input error         -> exit 3 (fail closed)
 *
 * Env: PROJECT, DRILL_DB (pageloom-restore-drill-YYYYMMDD, never "(default)"), SOURCE (gs:// export
 * prefix), TOKEN (OAuth access token). FIRESTORE_API_BASE overrides the API root (tests only).
 * Only GET/list calls are made. Output is aggregates only: no document ids beyond the first two
 * path segments, no field values.
 */
import { fileURLToPath } from "node:url";
import { evaluateRestore } from "./lib/restore-compare.mjs";

export const DRILL_DB_PATTERN = /^pageloom-restore-drill-\d{8}$/;

export function makeClient({ project, token, base = "https://firestore.googleapis.com/v1", fetchImpl = fetch }) {
  const headers = { Authorization: `Bearer ${token}`, "x-goog-user-project": project, "Content-Type": "application/json" };
  async function call(url, init) {
    const res = await fetchImpl(url, { headers, ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.split("?")[0].replace(base, "")}`);
    return res.json();
  }
  const dbRoot = (db) => `${base}/projects/${project}/databases/${db}`;

  /** Every real document (with createTime) in a database, walking subcollections of missing parents too. */
  async function walk(db) {
    const docsRoot = `${dbRoot(db)}/documents`;
    const out = new Map();
    async function visit(parent) {
      const { collectionIds = [] } = await call(`${parent}:listCollectionIds`, { method: "POST", body: JSON.stringify({ pageSize: 1000 }) });
      for (const c of collectionIds) {
        let pageToken = "";
        do {
          const page = await call(`${parent}/${encodeURIComponent(c)}?pageSize=300&showMissing=true${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`);
          for (const d of page.documents ?? []) {
            const rel = d.name.split("/documents/")[1];
            if (d.createTime) out.set(rel, { createTime: d.createTime, updateTime: d.updateTime, fields: d.fields });
            await visit(`${docsRoot}/${rel}`);
          }
          pageToken = page.nextPageToken ?? "";
        } while (pageToken);
      }
    }
    await visit(docsRoot);
    return out;
  }

  async function operations(db) {
    const ops = [];
    let pageToken = "";
    do {
      const page = await call(`${dbRoot(db)}/operations?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`);
      ops.push(...(page.operations ?? []));
      pageToken = page.nextPageToken ?? "";
    } while (pageToken);
    return ops;
  }
  return { walk, operations };
}

const opDocs = (op) => Number(op?.metadata?.progressDocuments?.completedWork ?? NaN);

export async function run({ mode, project, drillDb, source, client, minVerifiedRatio }) {
  if (!DRILL_DB_PATTERN.test(drillDb ?? "") || drillDb === "(default)") throw new Error(`refusing target database "${drillDb}"`);
  if (mode === "empty") {
    const n = (await client.walk(drillDb)).size;
    return { code: n === 0 ? 0 : 1, report: { mode, documentsInTarget: n } };
  }
  if (mode !== "full") throw new Error(`mode must be empty|full (got ${mode})`);
  if (!/^gs:\/\/[a-z0-9._-]+\/firestore\/\d{4}-\d{2}-\d{2}$/.test(source ?? "")) throw new Error(`invalid SOURCE ${source}`);

  const exportOp = (await client.operations("(default)")).find((o) => o.metadata?.outputUriPrefix === source && /ExportDocuments/.test(o.metadata?.["@type"] ?? ""));
  if (!exportOp) throw new Error(`no export operation found for ${source} (Firestore keeps operations ~30 days - use a recent export)`);
  const importOp = (await client.operations(drillDb)).filter((o) => o.metadata?.inputUriPrefix === source && /ImportDocuments/.test(o.metadata?.["@type"] ?? ""))
    .sort((a, b) => String(b.metadata.startTime).localeCompare(String(a.metadata.startTime)))[0];
  const [production, restored] = await Promise.all([client.walk("(default)"), client.walk(drillDb)]);
  const result = evaluateRestore({
    exportOp: { state: exportOp.metadata.operationState, startTime: exportOp.metadata.startTime, endTime: exportOp.metadata.endTime, documents: opDocs(exportOp) },
    importOp: importOp ? { state: importOp.metadata.operationState, documents: opDocs(importOp) } : null,
    production, restored, ...(minVerifiedRatio === undefined ? {} : { minVerifiedRatio }),
  });
  return { code: { PASS: 0, FAIL: 1, INCONCLUSIVE: 2 }[result.verdict], report: { mode, project, drillDb, source, exportWindow: [exportOp.metadata.startTime, exportOp.metadata.endTime], ...result } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { PROJECT: project, DRILL_DB: drillDb, SOURCE: source, TOKEN: token, FIRESTORE_API_BASE: base } = process.env;
  const mode = process.argv[2];
  try {
    if (!project || !token) throw new Error("PROJECT and TOKEN are required");
    const client = makeClient({ project, token, ...(base ? { base } : {}) });
    const { code, report } = await run({ mode, project, drillDb, source, client });
    console.log(JSON.stringify(report, null, 1));
    if (mode === "full") console.log(report.verdict === "PASS" ? "  RESTORE VERIFIED" : `  RESTORE ${report.verdict} - see reasons above`);
    process.exit(code);
  } catch (error) {
    console.error(`ERROR (fail closed): ${error.message}`);
    process.exit(3);
  }
}
