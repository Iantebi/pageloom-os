import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCTION_PROJECT_ID,
  normalizeProjectId,
  isProductionProject,
  isValidProjectIdFormat,
  assertNonProductionRestoreTarget,
} from "./project-guard.mjs";

test("production id in canonical form is rejected", () => {
  assert.throws(() => assertNonProductionRestoreTarget(PRODUCTION_PROJECT_ID), /never be a restore-drill target/);
});

test("production id is rejected regardless of case", () => {
  assert.throws(() => assertNonProductionRestoreTarget("PAGELOOM-OS-PRODUCTION"));
  assert.throws(() => assertNonProductionRestoreTarget("Pageloom-Os-Production"));
});

test("production id is rejected with surrounding or trailing whitespace", () => {
  assert.throws(() => assertNonProductionRestoreTarget("  pageloom-os-production  "));
  assert.throws(() => assertNonProductionRestoreTarget("pageloom-os-production\n"));
});

test("missing or empty target is rejected - there is no default restore target", () => {
  assert.throws(() => assertNonProductionRestoreTarget(undefined), /must be given explicitly/);
  assert.throws(() => assertNonProductionRestoreTarget(""), /must be given explicitly/);
  assert.throws(() => assertNonProductionRestoreTarget("   "), /must be given explicitly/);
});

test("non-string input is rejected", () => {
  assert.throws(() => assertNonProductionRestoreTarget(null));
  assert.throws(() => assertNonProductionRestoreTarget(123));
  assert.throws(() => assertNonProductionRestoreTarget({ projectId: "pageloom-restore-drill" }));
});

test("a valid non-production project id is accepted and returned trimmed", () => {
  assert.equal(assertNonProductionRestoreTarget("  pageloom-restore-drill  "), "pageloom-restore-drill");
});

test("a malformed project id is rejected even when it is not production", () => {
  assert.throws(() => assertNonProductionRestoreTarget("Not A Valid Id!"));
  assert.throws(() => assertNonProductionRestoreTarget("ab"));
});

test("isProductionProject / normalizeProjectId agree with the assertion's rejections", () => {
  assert.equal(isProductionProject("PAGELOOM-OS-PRODUCTION"), true);
  assert.equal(normalizeProjectId(" Pageloom-OS-Production "), PRODUCTION_PROJECT_ID);
  assert.equal(isProductionProject("pageloom-restore-drill"), false);
});

test("isValidProjectIdFormat rejects empty and uppercase, accepts a real-looking id", () => {
  assert.equal(isValidProjectIdFormat("pageloom-restore-drill"), true);
  assert.equal(isValidProjectIdFormat(""), false);
  assert.equal(isValidProjectIdFormat("UPPER-not-allowed"), false);
});
