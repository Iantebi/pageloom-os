import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { classify } from "./classify.mjs";

const policy = JSON.parse(
  readFileSync(fileURLToPath(new URL("../policy.json", import.meta.url)), "utf8"),
);

test("unapproved issue defaults to PROTECTED even with safe-sounding text", () => {
  const result = classify({ title: "Fix bug in login form", body: "", labels: [] }, policy);
  assert.equal(result.classification, "PROTECTED");
  assert.equal(result.matchedCategory, "not-approved");
});

test("approved issue matching a safe category is SAFE", () => {
  const result = classify(
    { title: "Fix crash on empty cart", body: "Add a bug fix for the null pointer.", labels: ["autonomous:approved"] },
    policy,
  );
  assert.equal(result.classification, "SAFE");
  assert.equal(result.matchedCategory, "bug-fix");
});

test("approved issue with no recognized safe category defaults to PROTECTED", () => {
  const result = classify(
    { title: "Improve the onboarding flow", body: "Make it nicer somehow.", labels: ["autonomous:approved"] },
    policy,
  );
  assert.equal(result.classification, "PROTECTED");
  assert.equal(result.matchedCategory, "default-unknown");
});

test("explicit safe label is honored when no protected keyword matches", () => {
  const result = classify(
    { title: "Tidy up utils", body: "", labels: ["autonomous:approved", "autonomous:safe"] },
    policy,
  );
  assert.equal(result.classification, "SAFE");
  assert.equal(result.matchedCategory, "explicit-safe-label");
});

test("protected keyword overrides approved + safe labels (defense in depth)", () => {
  const result = classify(
    {
      title: "Add a bug fix for billing",
      body: "This refactor also processes a refund for affected customers.",
      labels: ["autonomous:approved", "autonomous:safe"],
    },
    policy,
  );
  assert.equal(result.classification, "PROTECTED");
  assert.equal(result.matchedCategory, "money");
  assert.equal(result.matchedKeyword, "refund");
});

test("explicit protected label overrides everything, including safe keywords", () => {
  const result = classify(
    {
      title: "Add unit tests",
      body: "Simple test coverage bug fix.",
      labels: ["autonomous:approved", "autonomous:safe", "autonomous:protected"],
    },
    policy,
  );
  assert.equal(result.classification, "PROTECTED");
  assert.equal(result.matchedCategory, "explicit-protected-label");
});

test("firebase production deploy is always protected", () => {
  const result = classify(
    { title: "Refactor deploy script", body: "Run firebase deploy --only functions after refactor.", labels: ["autonomous:approved", "autonomous:safe"] },
    policy,
  );
  assert.equal(result.classification, "PROTECTED");
  assert.equal(result.matchedCategory, "firebase-cloud-production");
});

test("destructive database operation is always protected", () => {
  const result = classify(
    { title: "Clean up old records", body: "We should just delete production data that is stale.", labels: ["autonomous:approved", "autonomous:safe"] },
    policy,
  );
  assert.equal(result.classification, "PROTECTED");
  assert.equal(result.matchedCategory, "destructive-or-high-risk");
});

test("secrets rotation is always protected", () => {
  const result = classify(
    { title: "Rotate the API key", body: "", labels: ["autonomous:approved", "autonomous:safe"] },
    policy,
  );
  assert.equal(result.classification, "PROTECTED");
  assert.equal(result.matchedCategory, "secrets");
});

test("business-ops category (e.g. onboarding checklist) is SAFE once approved", () => {
  const result = classify(
    {
      title: "Draft onboarding checklist",
      body: "Write an onboarding checklist for new clients.",
      labels: ["autonomous:approved"],
    },
    policy,
  );
  assert.equal(result.classification, "SAFE");
  assert.equal(result.matchedCategory, "onboarding-asset");
});

test("documentation-only change is SAFE once approved", () => {
  const result = classify(
    { title: "Update README", body: "Fix a typo in the documentation.", labels: ["autonomous:approved"] },
    policy,
  );
  assert.equal(result.classification, "SAFE");
  assert.equal(result.matchedCategory, "documentation");
});
