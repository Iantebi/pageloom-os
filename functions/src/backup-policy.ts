export function backupPrefix(bucket: string, date = new Date()): string {
  if (!/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucket)) throw new Error("PAGELOOM_BACKUP_BUCKET is invalid");
  return `gs://${bucket}/firestore/${date.toISOString().slice(0, 10)}`;
}

export function firestoreExportUrl(projectId: string): string {
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) throw new Error("GCP_DEPLOY_PROJECT_ID is invalid");
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`;
}
