import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { determineRole, roleLabel, ROLE_DEVELOPER, ROLE_BUSINESS_OPS } from "./route.mjs";

const policy = JSON.parse(
  readFileSync(fileURLToPath(new URL("../policy.json", import.meta.url)), "utf8"),
);

test("PROTECTED tasks get no role", () => {
  const role = determineRole({ title: "x", body: "", labels: [] }, { classification: "PROTECTED" }, policy);
  assert.equal(role, null);
});

test("ordinary bug fix defaults to developer role", () => {
  const role = determineRole(
    { title: "Fix crash on empty cart", body: "bug fix", labels: [] },
    { classification: "SAFE" },
    policy,
  );
  assert.equal(role, ROLE_DEVELOPER);
});

test("business-process keyword routes to business-ops role", () => {
  const role = determineRole(
    { title: "Write onboarding checklist for new clients", body: "Draft an onboarding checklist.", labels: [] },
    { classification: "SAFE" },
    policy,
  );
  assert.equal(role, ROLE_BUSINESS_OPS);
});

test("explicit role-business-ops label overrides keyword guessing", () => {
  const role = determineRole(
    { title: "Fix bug in login form", body: "", labels: ["autonomous:role-business-ops"] },
    { classification: "SAFE" },
    policy,
  );
  assert.equal(role, ROLE_BUSINESS_OPS);
});

test("explicit role-developer label overrides a business-ops keyword hit", () => {
  const role = determineRole(
    { title: "Write onboarding checklist", body: "", labels: ["autonomous:role-developer"] },
    { classification: "SAFE" },
    policy,
  );
  assert.equal(role, ROLE_DEVELOPER);
});

test("roleLabel maps roles to their policy labels", () => {
  assert.equal(roleLabel("developer", policy), "autonomous:role-developer");
  assert.equal(roleLabel("business-ops", policy), "autonomous:role-business-ops");
  assert.equal(roleLabel("qa-safety", policy), "autonomous:role-qa-safety");
  assert.equal(roleLabel("nonsense", policy), null);
});
