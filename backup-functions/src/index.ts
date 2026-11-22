// Backup-only deploy package. These are the ONLY functions that remain in pageloom-os-production
// after the OS retirement. Names, schedules, region, memory, service accounts and retry settings
// are identical to the previous functions/src/index.ts so a deploy updates them in place.
// Do not add OS functions here (see docs/security plan: the old functions/ codebase re-created them).
import { onSchedule } from "firebase-functions/v2/scheduler";
import { params } from "./config.js";
import { exportFirestoreBackup } from "./backup.js";
import { runBackupFreshnessWatchdog } from "./watchdog.js";

export const dailyFirestoreBackup = onSchedule(
  { schedule: "30 2 * * *", timeZone: params.agencyTimezone, region: params.region, retryCount: 3, memory: "512MiB", timeoutSeconds: 540, serviceAccount: params.backupServiceAccount },
  exportFirestoreBackup,
);

export const backupFreshnessWatchdog = onSchedule(
  { schedule: "every 6 hours", region: params.region, serviceAccount: params.workersServiceAccount, retryCount: 3, memory: "512MiB" },
  runBackupFreshnessWatchdog,
);
