/**
 * Fail-closed guard against ever selecting pageloom-os-production as a restore-drill
 * target. This is the single source of truth every other module in this directory relies
 * on (gcloud-commands.mjs's mutating builders, restore-drill.mjs's plan builder) - see
 * project-guard.test.mjs for the executable proof that production is always rejected.
 */
export const PRODUCTION_PROJECT_ID = "pageloom-os-production";

// Real GCP project ids are always lowercase, start with a letter, and are 6-30 chars.
const VALID_PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

export function normalizeProjectId(projectId) {
  return typeof projectId === "string" ? projectId.trim().toLowerCase() : "";
}

export function isProductionProject(projectId) {
  return normalizeProjectId(projectId) === PRODUCTION_PROJECT_ID;
}

export function isValidProjectIdFormat(projectId) {
  return typeof projectId === "string" && VALID_PROJECT_ID_PATTERN.test(projectId.trim());
}

/**
 * Throws unless `projectId` is a syntactically valid, explicitly-given, non-production GCP
 * project id. There is deliberately no default here and no fallback to any configured
 * project - callers must always pass an explicit value. Returns the trimmed id on success.
 *
 * Called twice by restore-drill.mjs: once against the raw --target-project CLI argument
 * (before any command is even constructed), and again against the project id resolved by
 * a live `gcloud projects describe` call immediately before the restore actually runs.
 */
export function assertNonProductionRestoreTarget(projectId) {
  const trimmed = typeof projectId === "string" ? projectId.trim() : "";
  if (!trimmed) {
    throw new Error("A --target-project must be given explicitly - there is no default restore-drill target.");
  }
  if (!isValidProjectIdFormat(trimmed)) {
    throw new Error(`"${projectId}" is not a syntactically valid GCP project id.`);
  }
  if (isProductionProject(trimmed)) {
    throw new Error(
      `Refusing to restore into "${projectId}": ${PRODUCTION_PROJECT_ID} can never be a restore-drill target. ` +
        "Restore drills must target an isolated, non-production project only.",
    );
  }
  return trimmed;
}
