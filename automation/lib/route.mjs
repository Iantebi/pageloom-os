/**
 * Pure role-routing logic for the Autonomous Development Manager's worker roles.
 *
 * This never changes SAFE/PROTECTED classification — it only decides, for an already-SAFE
 * task, which worker role (Developer or Business & Operations) should implement it. The
 * QA & Safety role is never picked here: it is dispatched separately, per open PR, by
 * dispatch-qa-review.mjs, once a worker role has produced something to review.
 *
 * No network or filesystem access here on purpose, same rationale as lib/classify.mjs.
 */

export const ROLE_DEVELOPER = "developer";
export const ROLE_BUSINESS_OPS = "business-ops";
export const ROLE_QA_SAFETY = "qa-safety";
export const WORKER_ROLES = [ROLE_DEVELOPER, ROLE_BUSINESS_OPS];

function normalizeLabels(labels = []) {
  return labels.map((label) => (typeof label === "string" ? label : label.name).toLowerCase());
}

/**
 * @param {{title?: string, body?: string, labels?: (string|{name: string})[]}} task
 * @param {{classification: "SAFE"|"PROTECTED"}} decision - result of classify.mjs's classify()
 * @param {object} policy - parsed automation/policy.json
 * @returns {"developer"|"business-ops"|null} null if the task isn't SAFE (no role to assign)
 */
export function determineRole(task, decision, policy) {
  if (decision.classification !== "SAFE") return null;

  const labelNames = normalizeLabels(task.labels);

  // 1. An explicit human-set role label always wins over keyword guessing.
  if (labelNames.includes(policy.labels.roleBusinessOps)) return ROLE_BUSINESS_OPS;
  if (labelNames.includes(policy.labels.roleDeveloper)) return ROLE_DEVELOPER;

  // 2. Keyword match against the business/operations categories.
  const text = `${task.title ?? ""}\n${task.body ?? ""}`.toLowerCase();
  const businessOpsHit = (policy.businessOpsCategories ?? []).some((category) =>
    category.keywords.some((keyword) => text.includes(keyword.toLowerCase())),
  );
  if (businessOpsHit) return ROLE_BUSINESS_OPS;

  // 3. Default: SAFE, code-shaped work (bug fix, refactor, tests, docs, CI fix, etc.) goes
  //    to the Developer role.
  return ROLE_DEVELOPER;
}

/**
 * @param {"developer"|"business-ops"|"qa-safety"} role
 * @param {object} policy
 * @returns {string|null}
 */
export function roleLabel(role, policy) {
  if (role === ROLE_DEVELOPER) return policy.labels.roleDeveloper;
  if (role === ROLE_BUSINESS_OPS) return policy.labels.roleBusinessOps;
  if (role === ROLE_QA_SAFETY) return policy.labels.roleQaSafety;
  return null;
}
