#!/usr/bin/env node
// PageLoom Autonomous Development Manager — task classifier and selector.
//
// Pure, dependency-free logic used by the (draft) scheduled workflow in
// automation/workflows/autonomous-manager.yml.sample to decide which approved
// backlog issue, if any, is safe to hand to the existing @claude trigger.
//
// See automation/README.md for the full architecture and safety model.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadPolicy(path = join(__dirname, "policy.json")) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function matchesAny(haystack, needles) {
  const lower = haystack.toLowerCase();
  return needles.filter((needle) => lower.includes(needle.toLowerCase()));
}

function matchesAnyPath(paths, patterns) {
  const hits = [];
  for (const path of paths) {
    for (const pattern of patterns) {
      // Deliberately loose: strip glob wildcards and any leading slash so a
      // pattern like "**/*.secret*" reduces to the substring ".secret" and
      // still matches regardless of directory depth. Over-matching here is
      // the safe direction (fails closed to PROTECTED).
      const normalizedPattern = pattern.replace(/\*/g, "").replace(/^\/+/, "");
      if (normalizedPattern && path.includes(normalizedPattern)) {
        hits.push(path);
        break;
      }
    }
  }
  return hits;
}

/**
 * Classify a single task (an approved backlog issue, or a proposed change)
 * against the policy. Fails closed: anything not clearly SAFE is PROTECTED.
 *
 * @param {object} policy - parsed policy.json
 * @param {object} task
 * @param {string} task.title
 * @param {string} task.body
 * @param {string[]} [task.labels]
 * @param {string[]} [task.changedPaths] - optional, for classifying an in-flight diff
 * @returns {{ classification: "SAFE"|"PROTECTED", reasons: string[] }}
 */
export function classify(policy, task) {
  const labels = task.labels ?? [];
  const changedPaths = task.changedPaths ?? [];
  const text = `${task.title ?? ""}\n${task.body ?? ""}`;
  const reasons = [];

  for (const label of policy.protected.labels) {
    if (labels.includes(label)) {
      reasons.push(`label "${label}" is on the protected label list`);
    }
  }

  for (const category of policy.protected.categories) {
    const hits = matchesAny(text, category.keywords);
    if (hits.length > 0) {
      reasons.push(`matched protected category "${category.id}" via keyword(s): ${hits.join(", ")}`);
    }
  }

  const pathHits = matchesAnyPath(changedPaths, policy.protected.paths);
  if (pathHits.length > 0) {
    reasons.push(`touches protected path(s): ${pathHits.join(", ")}`);
  }

  if (reasons.length > 0) {
    return { classification: "PROTECTED", reasons };
  }

  if (!labels.includes(policy.backlog.requiredLabel)) {
    return {
      classification: "PROTECTED",
      reasons: [`missing required backlog label "${policy.backlog.requiredLabel}" — task is not an approved backlog item`],
    };
  }

  if (policy.defaultClassification === "PROTECTED") {
    // No protected signal matched, and the task is an approved backlog item
    // requesting ordinary engineering work (bug fix, refactor, tests, docs,
    // error handling, code-level hardening). That is exactly the SAFE list.
    return {
      classification: "SAFE",
      reasons: [
        `no protected keyword, path, or label matched`,
        `labeled "${policy.backlog.requiredLabel}" (explicit human approval to enter the backlog)`,
        `falls within the AUTONOMOUSLY ALLOWED task categories`,
      ],
    };
  }

  return { classification: "PROTECTED", reasons: ["policy default is PROTECTED and no SAFE rule matched"] };
}

function priorityRank(labels, priorityLabels) {
  const idx = priorityLabels.findIndex((p) => labels.includes(p));
  return idx === -1 ? priorityLabels.length : idx;
}

/**
 * Select the next SAFE task to run, skipping PROTECTED ones (but still
 * reporting them so the manager can flag them for Isaac) and anything
 * already locked/in-progress or done.
 *
 * @param {object} policy
 * @param {Array<object>} issues - GitHub issues, each with number/title/body/labels/created_at
 * @returns {{ next: object|null, skippedProtected: object[], considered: object[] }}
 */
export function selectNextTask(policy, issues) {
  const exclude = new Set(policy.backlog.excludeLabels);
  const eligible = issues.filter((issue) => {
    const labels = issue.labels ?? [];
    if (!labels.includes(policy.backlog.requiredLabel)) return false;
    if (labels.some((l) => exclude.has(l))) return false;
    return true;
  });

  eligible.sort((a, b) => {
    const rankDiff = priorityRank(a.labels ?? [], policy.backlog.priorityLabels) - priorityRank(b.labels ?? [], policy.backlog.priorityLabels);
    if (rankDiff !== 0) return rankDiff;
    return new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0);
  });

  const skippedProtected = [];
  for (const issue of eligible) {
    const result = classify(policy, issue);
    if (result.classification === "SAFE") {
      return { next: { issue, ...result }, skippedProtected, considered: eligible };
    }
    skippedProtected.push({ issue, ...result });
  }

  return { next: null, skippedProtected, considered: eligible };
}

// --- CLI ---------------------------------------------------------------
// Usage:
//   node automation/manager.mjs classify < task.json
//   node automation/manager.mjs select < issues.json
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , cmd] = process.argv;
  const input = JSON.parse(readFileSync(0, "utf8"));
  const policy = loadPolicy();

  if (cmd === "classify") {
    console.log(JSON.stringify(classify(policy, input), null, 2));
  } else if (cmd === "select") {
    console.log(JSON.stringify(selectNextTask(policy, input), null, 2));
  } else {
    console.error("Usage: node automation/manager.mjs <classify|select> < input.json");
    process.exit(1);
  }
}
