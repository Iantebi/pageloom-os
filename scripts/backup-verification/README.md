# Backup verification and restore-drill tooling

Repository-side tooling for the disaster-recovery process documented in
[`docs/disaster-recovery-runbook.md`](../../docs/disaster-recovery-runbook.md) (see its new
§13). Read that file first for the operational cadence and expected results; this file is
the map of what's here and how to run it.

| File | Purpose | Mutates production? |
|---|---|---|
| `verify-firestore-backup.mjs` | Lists the production backup bucket's Firestore export objects and reports the latest one's freshness (27h threshold, same as the live watchdog). | No - read-only `gcloud storage objects list`. |
| `verify-storage-transfer.mjs` | Lists the weekly Storage Transfer job's operations and reports the latest successful run's freshness (204h threshold). | No - read-only `gcloud transfer operations list`. |
| `verify-watchdog-freshness.mjs` | Reads recent `backupFreshnessWatchdog` Cloud Function logs and reports whether a heartbeat was seen and whether any stale/error event was logged. | No - read-only `gcloud functions logs read`. |
| `restore-drill.mjs` | Restores a Firestore export into an **explicit, non-production target project**. Fails closed (throws before running anything) if the target is `pageloom-os-production`, missing, or malformed. Prints, but never runs, the manual cleanup command. | Only ever mutates `--target-project`, which is guaranteed non-production - see below. |
| `lib/project-guard.mjs` | Pure function: the single source of truth for "is this target allowed for a restore drill?". Every mutating command in `lib/gcloud-commands.mjs` calls it independently. |
| `lib/gcloud-commands.mjs` | Pure builders for every `gcloud` command line this tooling can run - each command's exact argv is unit-tested without needing a `gcloud` binary or credentials. |
| `lib/freshness.mjs` | Freshness thresholds/evaluation, mirroring `functions/src/watchdog-policy.ts` (duplicated, not imported, so these scripts run standalone via plain `node`). |
| `lib/exec.mjs` | Thin `execFileSync`-based runner for the command descriptors above - never a shell string, so no argument can be interpreted as shell syntax. |

## Why production can never be a restore-drill target

This is enforced in layers, each independently tested (`lib/project-guard.test.mjs`,
`lib/gcloud-commands.test.mjs`, `restore-drill.test.mjs`):

1. `restore-drill.mjs` calls `assertNonProductionRestoreTarget()` on the raw `--target-project`
   argument before constructing any command.
2. Every mutating command builder in `lib/gcloud-commands.mjs`
   (`firestoreImportCommand`, `createFirestoreDatabaseCommand`, `deleteFirestoreDatabaseCommand`)
   calls the same guard again itself - a caller bug can never turn into a production mutation.
3. Before the actual restore runs, `restore-drill.mjs` re-resolves the target's identity via a
   read-only `gcloud projects describe` call and re-checks the **API-resolved** project id, not
   just the CLI argument.
4. The guard rejects the production id regardless of case or surrounding whitespace, rejects a
   missing/empty target outright (there is no default restore target), and validates the
   target is a syntactically valid GCP project id.

## Running the tests

```
npm run test:backup-tooling
# or directly:
node --test scripts/backup-verification/*.test.mjs scripts/backup-verification/lib/*.test.mjs
```

`test:backup-tooling` is chained onto the root `npm test` script, so `.github/workflows/ci.yml`
(which already runs `npm test`) exercises these tests on every PR with no workflow-file change
required.

## Local usage

The three verification scripts are read-only and safe to run at any time against production
(their whole purpose is inspecting it):

```
node scripts/backup-verification/verify-firestore-backup.mjs
node scripts/backup-verification/verify-storage-transfer.mjs
node scripts/backup-verification/verify-watchdog-freshness.mjs
```

Each prints a JSON evidence report and exits non-zero if what it found is `STALE` or
`unknown`, so they can be used directly in a cron/CI freshness check.

`restore-drill.mjs` always needs an explicit `--target-project` (never defaulted) and an
explicit `--export-date`. Use `--dry-run` first to inspect the exact commands it would run,
including the cleanup command it will print at the end but never execute itself:

```
node scripts/backup-verification/restore-drill.mjs \
  --target-project <your-non-production-project-id> \
  --export-date <YYYY-MM-DD> \
  --dry-run
```

Only drop `--dry-run` once you're ready to actually perform the restore against that target
project. Cleanup afterward (`gcloud firestore databases delete ...`) is always a separate,
manual step - run the command the script prints yourself once you've finished verifying the
restored data.
