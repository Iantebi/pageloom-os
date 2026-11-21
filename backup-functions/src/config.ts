import { defineString } from "firebase-functions/params";

// Only the params the two backup functions use. Defaults equal the production values (verified
// 2026-11-20 against the previous functions/.env.pageloom-os-production). An interactive deploy
// offers these defaults; a --non-interactive deploy needs backup-functions/.env.pageloom-os-production
// (gitignored by the repo's .env* rule) with the same 7 non-secret values.
// No defineSecret here on purpose: these functions bind no secrets.
export const params = {
  region: defineString("PAGELOOM_FUNCTION_REGION", { default: "europe-west1" }),
  gcpDeployProject: defineString("GCP_DEPLOY_PROJECT_ID", { default: "pageloom-os-production" }),
  backupBucket: defineString("PAGELOOM_BACKUP_BUCKET", { default: "pageloom-os-production-backups" }),
  backupServiceAccount: defineString("PAGELOOM_BACKUP_SERVICE_ACCOUNT", { default: "pageloom-backup@pageloom-os-production.iam.gserviceaccount.com" }),
  workersServiceAccount: defineString("PAGELOOM_WORKERS_SERVICE_ACCOUNT", { default: "pageloom-workers@pageloom-os-production.iam.gserviceaccount.com" }),
  agencyTimezone: defineString("AGENCY_TIMEZONE", { default: "Asia/Jerusalem" }),
  mediaBackupTransferJobName: defineString("PAGELOOM_MEDIA_TRANSFER_JOB", { default: "transferJobs/13003081908546702248" }),
};
