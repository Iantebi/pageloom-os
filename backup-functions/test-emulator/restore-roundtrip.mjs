// Restore round-trip on the Firestore emulator, run in CI as two emulator sessions:
//   emulators:exec --export-on-exit=<dir> "node restore-roundtrip.mjs seed"
//   emulators:exec --import=<dir>         "node restore-roundtrip.mjs verify"
// Proves data written with the deployed Admin SDK version survives export -> import into a fresh
// database with ids, types, timestamps, nested data, references and subcollections intact.
// This is the emulator's export format, not a real managed export: the real GCS export/import path
// is covered by scripts/backup-verification/restore-drill.mjs (non-production project only).
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, GeoPoint, FieldValue } from "firebase-admin/firestore";

const mode = process.argv[2];
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("refusing to run without FIRESTORE_EMULATOR_HOST");
const projectId = process.env.GCLOUD_PROJECT ?? "";
if (!projectId.startsWith("demo-")) throw new Error("refusing to run against a non-demo project id");
initializeApp({ projectId });
const db = getFirestore();

const N = 1200; // > a single page/batch, exercises bulk paths
const fixed = {
  text: "שלום – unicode ✓",
  int: 42, float: 3.25, bool: true, nil: null,
  ts: Timestamp.fromMillis(1_790_000_000_123),
  geo: new GeoPoint(32.08, 34.78),
  arr: [1, "two", { three: 3 }],
  nested: { a: { b: { c: "deep" } } },
  bytes: Buffer.from([0, 1, 2, 255]),
};

if (mode === "seed") {
  let batch = db.batch(); let n = 0;
  for (let i = 0; i < N; i++) {
    batch.set(db.doc(`clients/c${String(i).padStart(4, "0")}`), { i, name: `client ${i}`, ...fixed });
    if (++n === 400) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  await batch.commit();
  await db.doc("clients/c0000/answers/q1").set({ v: "sub", ref: db.doc("clients/c0001"), at: FieldValue.serverTimestamp() });
  await db.doc("systemOperations/backups/runs/seed").set({ status: "started" });
  console.log(`SEEDED ${N} docs + subcollection + run doc`);
} else if (mode === "verify") {
  const all = await db.collection("clients").get();
  if (all.size !== N) throw new Error(`expected ${N} clients, got ${all.size}`);
  const d = (await db.doc("clients/c0777").get()).data();
  const checks = {
    i: d.i === 777, text: d.text === fixed.text, int: d.int === 42, float: d.float === 3.25, bool: d.bool === true, nil: d.nil === null,
    ts: d.ts instanceof Timestamp && d.ts.toMillis() === fixed.ts.toMillis(),
    geo: d.geo instanceof GeoPoint && d.geo.latitude === 32.08 && d.geo.longitude === 34.78,
    arr: JSON.stringify(d.arr) === JSON.stringify(fixed.arr),
    nested: d.nested.a.b.c === "deep",
    bytes: Buffer.compare(Buffer.from(d.bytes), fixed.bytes) === 0,
  };
  const sub = (await db.doc("clients/c0000/answers/q1").get()).data();
  checks.subcollection = sub?.v === "sub" && sub.ref.path === "clients/c0001" && sub.at instanceof Timestamp;
  checks.runDoc = (await db.doc("systemOperations/backups/runs/seed").get()).data()?.status === "started";
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  if (failed.length) throw new Error(`RESTORE MISMATCH: ${failed.join(", ")}`);
  console.log(`RESTORE VERIFIED: ${all.size} docs, ${Object.keys(checks).length} field/type checks passed`);
} else throw new Error("mode must be seed|verify");
