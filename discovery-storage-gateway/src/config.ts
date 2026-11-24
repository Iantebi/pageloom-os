import { defineSecret, defineString } from "firebase-functions/params";

// Defaults are the planned production values (docs/security/DISCOVERY-STORAGE-GATEWAY-PLAN-HE.md).
// Nothing exists in production until the owner approves the infrastructure step.
export const params = {
  region: defineString("DISCOVERY_GATEWAY_REGION", { default: "europe-west1" }),
  primaryBucket: defineString("DISCOVERY_FILES_BUCKET", { default: "pageloom-discovery-files" }),
  backupBucket: defineString("DISCOVERY_FILES_BACKUP_BUCKET", { default: "pageloom-discovery-files-backup" }),
  serviceAccount: defineString("DISCOVERY_GATEWAY_SERVICE_ACCOUNT", { default: "discovery-storage-gw@pageloom-os-production.iam.gserviceaccount.com" }),
};

// Shared HMAC secret (>= 32 chars). Stored in Secret Manager and in the Base44 app's secrets; never
// in the repository, logs or chat.
export const gatewaySecret = defineSecret("DISCOVERY_GATEWAY_SECRET");
