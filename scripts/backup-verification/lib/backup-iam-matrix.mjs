/**
 * Expected IAM access for the two backup functions at each stage of
 * scripts/ops/sec-backup-iam-least-privilege.sh, checked with the Policy Troubleshooter (read-only;
 * it evaluates IAM conditions against the resource we pass). Pure - see ../check-backup-iam.mjs.
 *
 * Why this exists: a manual backup run that returns "already exists" does not by itself prove the
 * export permission. This matrix proves, before and after every change, (1) every permission the two
 * functions really use is still granted - and by which role - and (2) the removed ones are gone.
 */
export const PROJECT = "pageloom-os-production";
const D = `${PROJECT}.iam.gserviceaccount.com`;
export const BACKUP_SA = `pageloom-backup@${D}`;
export const WORKERS_SA = `pageloom-workers@${D}`;
export const FIRESTORE_AGENT = "service-386075478217@gcp-sa-firestore.iam.gserviceaccount.com";
export const EXPORTER_ROLE = "pageloomFirestoreExporter";
// Client Discovery storage gateway (separate system, codebase "discovery-gateway", added 2026-11-24).
// The backup IAM stages must never touch it; these checks prove both directions of the separation.
export const DISCOVERY_GW_SA = `discovery-storage-gw@${D}`;

const PROJECT_RES = `//cloudresourcemanager.googleapis.com/projects/${PROJECT}`;
const BUCKET_RES = "//storage.googleapis.com/projects/_/buckets/pageloom-os-production-backups";
const DISCOVERY_BUCKETS = ["pageloom-discovery-files", "pageloom-discovery-files-backup"].map((b) => `//storage.googleapis.com/projects/_/buckets/${b}`);
const run = (svc) => `//run.googleapis.com/projects/${PROJECT}/locations/europe-west1/services/${svc}`;
const db = (name) => ({ name: `projects/${PROJECT}/databases/${name}`, service: "firestore.googleapis.com", type: "firestore.googleapis.com/Database" });
const CAN = "CAN_ACCESS";
const CANNOT = "CANNOT_ACCESS";

/** What the functions need in every phase - must never break. */
const ALWAYS = [
  { id: "backup-writes-run-records", principal: BACKUP_SA, permission: "datastore.entities.create", resource: PROJECT_RES, context: db("(default)"), expect: CAN },
  { id: "backup-invoked-by-scheduler", principal: BACKUP_SA, permission: "run.routes.invoke", resource: run("dailyfirestorebackup"), expect: CAN },
  { id: "firestore-agent-writes-export-files", principal: FIRESTORE_AGENT, permission: "storage.objects.create", resource: BUCKET_RES, expect: CAN },
  { id: "watchdog-invoked-by-scheduler", principal: WORKERS_SA, permission: "run.routes.invoke", resource: run("backupfreshnesswatchdog"), expect: CAN },
  { id: "watchdog-lists-backup-bucket", principal: WORKERS_SA, permission: "storage.objects.list", resource: BUCKET_RES, expect: CAN },
  { id: "watchdog-reads-transfer-ops", principal: WORKERS_SA, permission: "storagetransfer.operations.list", resource: PROJECT_RES, expect: CAN },
  { id: "watchdog-reads-service-health", principal: WORKERS_SA, permission: "servicehealth.events.list", resource: PROJECT_RES, expect: CAN },
  // Discovery gateway keeps its own access (unaffected by every stage) ...
  ...DISCOVERY_BUCKETS.flatMap((bucket) => [
    { id: `discovery-gw-writes-${bucket.split("/").pop()}`, principal: DISCOVERY_GW_SA, permission: "storage.objects.create", resource: bucket, expect: CAN },
    { id: `discovery-gw-reads-${bucket.split("/").pop()}`, principal: DISCOVERY_GW_SA, permission: "storage.objects.get", resource: bucket, expect: CAN },
  ]),
  // ... and neither backup service account can read client files.
  ...DISCOVERY_BUCKETS.flatMap((bucket) => [BACKUP_SA, WORKERS_SA].map((principal) => (
    { id: `${principal.split("@")[0]}-cannot-read-${bucket.split("/").pop()}`, principal, permission: "storage.objects.get", resource: bucket, expect: CANNOT }
  ))),
];
const exportDefault = (extra) => ({ id: "backup-can-export-default-db", principal: BACKUP_SA, permission: "datastore.databases.export", resource: PROJECT_RES, context: db("(default)"), expect: CAN, ...extra });

const PHASES = {
  // Today, before any change (documents the risks being removed).
  current: [
    exportDefault({ via: ["datastore.importExportAdmin"] }),
    { id: "backup-can-import-default-db (risk)", principal: BACKUP_SA, permission: "datastore.databases.import", resource: PROJECT_RES, context: db("(default)"), expect: CAN },
    { id: "backup-can-delete-backup-files (risk)", principal: BACKUP_SA, permission: "storage.objects.delete", resource: BUCKET_RES, expect: CAN },
    { id: "watchdog-has-firestore (unused)", principal: WORKERS_SA, permission: "datastore.entities.get", resource: PROJECT_RES, context: db("(default)"), expect: CAN },
  ],
  // New role granted, old one still present: the NEW binding must already grant export on its own.
  "after-grant": [exportDefault({ via: [EXPORTER_ROLE] })],
  "after-exporter": [
    exportDefault({ via: [EXPORTER_ROLE], only: true }),
    { id: "backup-cannot-import-default-db", principal: BACKUP_SA, permission: "datastore.databases.import", resource: PROJECT_RES, context: db("(default)"), expect: CANNOT },
    { id: "backup-cannot-export-other-dbs", principal: BACKUP_SA, permission: "datastore.databases.export", resource: PROJECT_RES, context: db("pageloom-restore-drill-00000000"), expect: CANNOT },
  ],
  "after-bucket": [
    { id: "backup-cannot-write-backup-files", principal: BACKUP_SA, permission: "storage.objects.create", resource: BUCKET_RES, expect: CANNOT },
    { id: "backup-cannot-delete-backup-files", principal: BACKUP_SA, permission: "storage.objects.delete", resource: BUCKET_RES, expect: CANNOT },
  ],
  "after-workers": [
    { id: "watchdog-has-no-firestore", principal: WORKERS_SA, permission: "datastore.entities.get", resource: PROJECT_RES, context: db("(default)"), expect: CANNOT },
  ],
};
const ORDER = ["after-exporter", "after-bucket", "after-workers"];

/** Checks for a phase. Later phases include the earlier ones' end state (stages run in order). */
export function checksFor(phase) {
  if (!PHASES[phase]) throw new Error(`unknown phase ${phase} (use: ${Object.keys(PHASES).join(", ")})`);
  const cumulative = ORDER.includes(phase) ? ORDER.slice(0, ORDER.indexOf(phase) + 1).flatMap((p) => PHASES[p]) : PHASES[phase];
  return [...ALWAYS, ...cumulative];
}

/** Request body for POST https://policytroubleshooter.googleapis.com/v3/iam:troubleshoot */
export function troubleshootBody(check) {
  return { accessTuple: { principal: check.principal, permission: check.permission, fullResourceName: check.resource, ...(check.context ? { conditionContext: { resource: check.context } } : {}) } };
}

/** Roles (short ids) whose binding GRANTS the permission in a troubleshooter response. */
export function grantingRoles(response) {
  const roles = [];
  for (const policy of response?.allowPolicyExplanation?.explainedPolicies ?? []) {
    for (const b of policy.bindingExplanations ?? []) {
      if (b.allowAccessState === "ALLOW_ACCESS_STATE_GRANTED") roles.push(String(b.role).split("/").pop());
    }
  }
  return [...new Set(roles)];
}

/** Evaluates one check against a troubleshooter response. Anything not clearly as expected fails. */
export function evaluateCheck(check, response) {
  const state = response?.overallAccessState ?? "NO_RESPONSE";
  const roles = grantingRoles(response);
  const problems = [];
  if (state !== check.expect) problems.push(`expected ${check.expect}, got ${state}`);
  if (check.expect === CAN && check.via && !check.via.some((r) => roles.includes(r))) problems.push(`not granted by ${check.via.join("/")} (granted by: ${roles.join(", ") || "nothing"})`);
  if (check.only && roles.some((r) => !check.via.includes(r))) problems.push(`also granted by ${roles.filter((r) => !check.via.includes(r)).join(", ")}`);
  return { id: check.id, ok: problems.length === 0, state, roles, problems };
}

export function evaluatePhase(results) {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, total: results.length, failed };
}
