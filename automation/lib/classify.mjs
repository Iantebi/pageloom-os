/**
 * Pure SAFE/PROTECTED classification logic for the Autonomous Development Manager.
 *
 * No network or filesystem access here on purpose: this module is the one piece of the
 * manager that decides whether work may proceed without a human, so it stays a small,
 * fully unit-testable function. Everything that talks to GitHub lives in select-next-task.mjs
 * and check-merge-eligibility.mjs instead.
 */

function normalizeLabels(labels = []) {
  return labels.map((label) => (typeof label === "string" ? label : label.name).toLowerCase());
}

function findKeywordHit(text, categories) {
  for (const category of categories) {
    const hit = category.keywords.find((keyword) => text.includes(keyword.toLowerCase()));
    if (hit) {
      return { category, hit };
    }
  }
  return null;
}

/**
 * @param {{title?: string, body?: string, labels?: (string|{name: string})[]}} task
 * @param {object} policy - parsed automation/policy.json
 * @returns {{classification: "SAFE"|"PROTECTED", reason: string, matchedCategory: string, matchedKeyword?: string}}
 */
export function classify(task, policy) {
  const title = task.title ?? "";
  const body = task.body ?? "";
  const text = `${title}\n${body}`.toLowerCase();
  const labelNames = normalizeLabels(task.labels);

  // 1. An explicit PROTECTED label always wins, before anything else is evaluated.
  if (labelNames.includes(policy.labels.protected)) {
    return {
      classification: "PROTECTED",
      reason: `Issue is explicitly labeled "${policy.labels.protected}".`,
      matchedCategory: "explicit-protected-label",
    };
  }

  // 2. Hard keyword scan against every protected category. This is defense in depth and
  //    CANNOT be overridden by an "approved" or "safe" label — a mislabeled issue must not
  //    be able to authorize money, production, secrets, infra, customer-data, or destructive work.
  const protectedHit = findKeywordHit(text, policy.protectedCategories);
  if (protectedHit) {
    return {
      classification: "PROTECTED",
      reason: `Matched protected category "${protectedHit.category.id}" (${protectedHit.category.description}) via keyword "${protectedHit.hit}".`,
      matchedCategory: protectedHit.category.id,
      matchedKeyword: protectedHit.hit,
    };
  }

  // 3. Autonomous work only proceeds from an explicitly approved backlog item.
  if (!labelNames.includes(policy.labels.approved)) {
    return {
      classification: "PROTECTED",
      reason: `Issue does not carry the required "${policy.labels.approved}" label; unapproved backlog items default to PROTECTED.`,
      matchedCategory: "not-approved",
    };
  }

  // 4. Must positively match a recognized SAFE category, or carry an explicit human "safe" label.
  //    Business/Operations categories (repository-based docs, onboarding, templates) are also
  //    SAFE-qualifying here — route.mjs only decides which worker role handles an already-SAFE
  //    task, it never has authority to classify PROTECTED work as SAFE.
  const safeHit = findKeywordHit(text, [...policy.safeCategories, ...(policy.businessOpsCategories ?? [])]);
  if (safeHit) {
    return {
      classification: "SAFE",
      reason: `Matched safe category "${safeHit.category.id}" (${safeHit.category.description}) via keyword "${safeHit.hit}".`,
      matchedCategory: safeHit.category.id,
      matchedKeyword: safeHit.hit,
    };
  }
  if (labelNames.includes(policy.labels.safe)) {
    return {
      classification: "SAFE",
      reason: `Explicitly labeled "${policy.labels.safe}" by a human reviewer, and no protected keyword matched.`,
      matchedCategory: "explicit-safe-label",
    };
  }

  // 5. Unknown work defaults to PROTECTED, per policy.
  return {
    classification: "PROTECTED",
    reason: `No recognized SAFE category matched and no explicit "${policy.labels.safe}" label; unknown work defaults to PROTECTED (policy.default = "${policy.default}").`,
    matchedCategory: "default-unknown",
  };
}
