/**
 * Pure builders for the `gcloud` command lines this tooling runs. Kept separate from
 * lib/exec.mjs (which actually shells out) so every command's exact argv can be unit
 * tested without a `gcloud` binary, network access, or credentials - see
 * gcloud-commands.test.mjs.
 *
 * Read-only builders (top section) only ever construct list/describe/read invocations and
 * default their project to pageloom-os-production. Mutating builders (bottom section) are
 * used only by restore-drill.mjs and each independently re-validates its target via
 * assertNonProductionRestoreTarget - even though callers must already have checked - so a
 * caller bug can never turn into a production mutation.
 */
import { PRODUCTION_PROJECT_ID, assertNonProductionRestoreTarget } from "./project-guard.mjs";

const GS_URI_PATTERN = /^gs:\/\/[^\s]+$/;

// --- Read-only: safe to run against pageloom-os-production at any time. ---

export function describeProjectCommand(projectId = PRODUCTION_PROJECT_ID) {
  return { command: "gcloud", args: ["projects", "describe", projectId, "--format=json"] };
}

export function listFirestoreExportObjectsCommand(bucket) {
  if (!bucket) throw new Error("A backup bucket name is required.");
  return { command: "gcloud", args: ["storage", "objects", "list", `gs://${bucket}/firestore/`, "--format=json"] };
}

export function describeTransferJobCommand(jobName, projectId = PRODUCTION_PROJECT_ID) {
  if (!jobName) throw new Error("A Storage Transfer job name is required.");
  return { command: "gcloud", args: ["transfer", "jobs", "describe", jobName, `--project=${projectId}`, "--format=json"] };
}

export function listTransferOperationsCommand(jobName, projectId = PRODUCTION_PROJECT_ID) {
  if (!jobName) throw new Error("A Storage Transfer job name is required.");
  return { command: "gcloud", args: ["transfer", "operations", "list", `--job-names=${jobName}`, `--project=${projectId}`, "--format=json"] };
}

export function readWatchdogLogsCommand(functionName, { projectId = PRODUCTION_PROJECT_ID, limit = 50, region = "europe-west1", gen2 = true } = {}) {
  if (!functionName) throw new Error("A function name is required.");
  const args = ["functions", "logs", "read", functionName, `--project=${projectId}`, `--region=${region}`, `--limit=${limit}`, "--format=json"];
  // backupFreshnessWatchdog is deployed via firebase-functions/v2 (functions/src/index.ts),
  // i.e. a 2nd-gen function - `gcloud functions logs read` needs --gen2 to find it.
  if (gen2) args.push("--gen2");
  return { command: "gcloud", args };
}

// --- Mutating: restore-drill.mjs only. Never called by any read-only verification script. ---

export function firestoreImportCommand(targetProjectId, sourceUri, databaseId) {
  const project = assertNonProductionRestoreTarget(targetProjectId);
  if (!sourceUri || !GS_URI_PATTERN.test(sourceUri)) throw new Error(`Invalid source export URI: "${sourceUri}"`);
  if (!databaseId) throw new Error("A --database id is required for the restore-drill target database.");
  return {
    command: "gcloud",
    args: ["firestore", "import", sourceUri, `--project=${project}`, `--database=${databaseId}`, "--format=json"],
  };
}

export function createFirestoreDatabaseCommand(targetProjectId, databaseId, { locationId = "eur3" } = {}) {
  const project = assertNonProductionRestoreTarget(targetProjectId);
  if (!databaseId) throw new Error("A --database id is required.");
  return {
    command: "gcloud",
    args: [
      "firestore", "databases", "create",
      `--database=${databaseId}`, `--project=${project}`, `--location=${locationId}`, "--type=firestore-native",
      "--format=json",
    ],
  };
}

// Cleanup is a SEPARATE, manual step: restore-drill.mjs builds this descriptor only to print
// it, and never passes it to lib/exec.mjs itself. A human runs it by hand after verifying.
export function deleteFirestoreDatabaseCommand(targetProjectId, databaseId) {
  const project = assertNonProductionRestoreTarget(targetProjectId);
  if (!databaseId) throw new Error("A --database id is required.");
  return {
    command: "gcloud",
    args: ["firestore", "databases", "delete", `--database=${databaseId}`, `--project=${project}`, "--quiet", "--format=json"],
  };
}
