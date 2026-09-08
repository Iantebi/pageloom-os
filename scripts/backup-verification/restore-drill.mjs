#!/usr/bin/env node
/**
 * Isolated restore-drill workflow. Restores a Firestore export into an explicit,
 * non-production target project ONLY - it never targets pageloom-os-production, and fails
 * closed (throws before constructing or running any command) if the target is production,
 * missing, or malformed. See lib/project-guard.mjs and restore-drill.test.mjs for the
 * layered proof of that guarantee.
 *
 * This script only ever imports data INTO --target-project. Beyond the read-only project
 * describe call used to confirm the target's own identity, it never reads, writes, or
 * deletes anything in pageloom-os-production.
 *
 * Cleanup (deleting the restored temporary database) is intentionally NOT performed by this
 * script - buildRestorePlan() only builds that command so it can be printed. Run it
 * yourself, by hand, as a separately approved step, once you've finished verifying the
 * restored data.
 *
 * Usage:
 *   node scripts/backup-verification/restore-drill.mjs \
 *     --target-project <non-production-project-id> \
 *     --export-date <YYYY-MM-DD> \
 *     [--database pageloom-restore-drill] \
 *     [--source-bucket pageloom-os-production-backups] \
 *     [--dry-run]
 *
 * --dry-run prints the exact commands the drill would run (including the manual cleanup
 * command) without executing anything - use this to inspect the plan safely.
 */
import { fileURLToPath } from "node:url";
import { assertNonProductionRestoreTarget } from "./lib/project-guard.mjs";
import { describeProjectCommand, firestoreImportCommand, deleteFirestoreDatabaseCommand } from "./lib/gcloud-commands.mjs";
import { runCommand, runJson } from "./lib/exec.mjs";

const EXPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Pure: validates inputs and builds every command descriptor the drill needs, without
 * running anything. Throws on a production target, a missing target, or a malformed
 * export date - this is what restore-drill.test.mjs exercises directly.
 */
export function buildRestorePlan({ targetProject, exportDate, database = "pageloom-restore-drill", sourceBucket = "pageloom-os-production-backups" }) {
  const target = assertNonProductionRestoreTarget(targetProject);
  if (!exportDate || !EXPORT_DATE_PATTERN.test(exportDate)) {
    throw new Error(`--export-date must be given as YYYY-MM-DD (got "${exportDate}").`);
  }
  const sourceUri = `gs://${sourceBucket}/firestore/${exportDate}`;
  return {
    target,
    sourceUri,
    verifyDescriptor: describeProjectCommand(target),
    importDescriptor: firestoreImportCommand(target, sourceUri, database),
    cleanupDescriptor: deleteFirestoreDatabaseCommand(target, database),
  };
}

function parseArgs(argv) {
  const flag = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
  return {
    targetProject: flag("--target-project"),
    exportDate: flag("--export-date"),
    database: flag("--database", "pageloom-restore-drill"),
    sourceBucket: flag("--source-bucket", "pageloom-os-production-backups"),
    dryRun: argv.includes("--dry-run"),
  };
}

function formatCommand({ command, args }) {
  return `${command} ${args.join(" ")}`;
}

function main() {
  const { targetProject, exportDate, database, sourceBucket, dryRun } = parseArgs(process.argv.slice(2));

  let plan;
  try {
    plan = buildRestorePlan({ targetProject, exportDate, database, sourceBucket });
  } catch (error) {
    console.error(`[restore-drill] ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      target: plan.target,
      wouldVerify: plan.verifyDescriptor,
      wouldImport: plan.importDescriptor,
      cleanupCommandToRunManuallyAfterVerifying: plan.cleanupDescriptor,
    }, null, 2));
    return;
  }

  // Verify the target's identity via a read-only project describe BEFORE the restore, and
  // re-check the API-RESOLVED id (not just the CLI argument already checked in
  // buildRestorePlan) - defense against any mismatch between what was typed and what
  // gcloud/ADC actually resolves.
  const project = runJson(plan.verifyDescriptor);
  const resolvedId = project?.projectId;
  if (resolvedId !== plan.target) {
    console.error(`[restore-drill] Resolved project id "${resolvedId}" does not match requested --target-project "${plan.target}" - refusing to continue.`);
    process.exitCode = 1;
    return;
  }
  assertNonProductionRestoreTarget(resolvedId); // re-check the API-resolved id too, not just the CLI argument

  console.log(`[restore-drill] Verified target project "${resolvedId}" is not production. Starting import...`);
  console.log(runCommand(plan.importDescriptor));

  console.log("[restore-drill] Import requested. Next steps (manual, not run by this script):");
  console.log("  1. Verify the restored data in the target project (document counts, spot-check a document) -");
  console.log("     see docs/disaster-recovery-runbook.md's restore verification policy for the expected checks.");
  console.log("  2. Record the verification evidence in docs/disaster-recovery-runbook.md, per its cadence.");
  console.log("  3. When done, clean up by running this command yourself - it is NOT run automatically:");
  console.log(`     ${formatCommand(plan.cleanupDescriptor)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
