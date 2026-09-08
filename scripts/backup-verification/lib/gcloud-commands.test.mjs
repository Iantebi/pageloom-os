import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describeProjectCommand,
  listFirestoreExportObjectsCommand,
  describeTransferJobCommand,
  listTransferOperationsCommand,
  readWatchdogLogsCommand,
  firestoreImportCommand,
  createFirestoreDatabaseCommand,
  deleteFirestoreDatabaseCommand,
} from "./gcloud-commands.mjs";
import { PRODUCTION_PROJECT_ID } from "./project-guard.mjs";

const PRODUCTION_VARIANTS = [PRODUCTION_PROJECT_ID, "PAGELOOM-OS-PRODUCTION", "  pageloom-os-production  ", undefined, ""];

test("read-only commands default their project to pageloom-os-production", () => {
  assert.ok(describeProjectCommand().args.includes(PRODUCTION_PROJECT_ID));
  assert.ok(describeTransferJobCommand("transferJobs/123").args.includes(`--project=${PRODUCTION_PROJECT_ID}`));
  assert.ok(listTransferOperationsCommand("transferJobs/123").args.includes(`--project=${PRODUCTION_PROJECT_ID}`));
  assert.ok(readWatchdogLogsCommand("backupFreshnessWatchdog").args.includes(`--project=${PRODUCTION_PROJECT_ID}`));
});

test("read-only commands only ever use list/describe/read verbs, never a mutating one", () => {
  const mutatingVerbs = ["import", "export", "create", "delete", "update"];
  const commands = [
    describeProjectCommand("some-project"),
    listFirestoreExportObjectsCommand("some-bucket"),
    describeTransferJobCommand("transferJobs/123", "some-project"),
    listTransferOperationsCommand("transferJobs/123", "some-project"),
    readWatchdogLogsCommand("backupFreshnessWatchdog", { projectId: "some-project" }),
  ];
  for (const { args } of commands) {
    for (const verb of mutatingVerbs) assert.ok(!args.includes(verb), `expected no "${verb}" in ${JSON.stringify(args)}`);
  }
});

test("listFirestoreExportObjectsCommand requires a bucket", () => {
  assert.throws(() => listFirestoreExportObjectsCommand());
});

for (const productionVariant of PRODUCTION_VARIANTS) {
  test(`firestoreImportCommand refuses target ${JSON.stringify(productionVariant)}`, () => {
    assert.throws(() => firestoreImportCommand(productionVariant, "gs://bucket/firestore/2026-09-01", "drill-db"));
  });
  test(`createFirestoreDatabaseCommand refuses target ${JSON.stringify(productionVariant)}`, () => {
    assert.throws(() => createFirestoreDatabaseCommand(productionVariant, "drill-db"));
  });
  test(`deleteFirestoreDatabaseCommand refuses target ${JSON.stringify(productionVariant)}`, () => {
    assert.throws(() => deleteFirestoreDatabaseCommand(productionVariant, "drill-db"));
  });
}

test("firestoreImportCommand builds the exact invocation for a valid non-production target", () => {
  const { command, args } = firestoreImportCommand(
    "pageloom-restore-drill",
    "gs://pageloom-os-production-backups/firestore/2026-09-01",
    "pageloom-restore-drill",
  );
  assert.equal(command, "gcloud");
  assert.deepEqual(args, [
    "firestore", "import", "gs://pageloom-os-production-backups/firestore/2026-09-01",
    "--project=pageloom-restore-drill", "--database=pageloom-restore-drill", "--format=json",
  ]);
});

test("firestoreImportCommand rejects a non gs:// source", () => {
  assert.throws(() => firestoreImportCommand("pageloom-restore-drill", "not-a-gs-uri", "drill-db"));
});

test("firestoreImportCommand requires a database id", () => {
  assert.throws(() => firestoreImportCommand("pageloom-restore-drill", "gs://bucket/firestore/2026-09-01"));
});

test("deleteFirestoreDatabaseCommand builds the exact cleanup command", () => {
  const { command, args } = deleteFirestoreDatabaseCommand("pageloom-restore-drill", "pageloom-restore-drill");
  assert.equal(command, "gcloud");
  assert.deepEqual(args, [
    "firestore", "databases", "delete",
    "--database=pageloom-restore-drill", "--project=pageloom-restore-drill", "--quiet", "--format=json",
  ]);
});

test("createFirestoreDatabaseCommand builds the exact create command", () => {
  const { args } = createFirestoreDatabaseCommand("pageloom-restore-drill", "pageloom-restore-drill");
  assert.deepEqual(args, [
    "firestore", "databases", "create",
    "--database=pageloom-restore-drill", "--project=pageloom-restore-drill", "--location=eur3", "--type=firestore-native",
    "--format=json",
  ]);
});
