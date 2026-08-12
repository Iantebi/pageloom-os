import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rules = readFileSync(new URL("../../storage.rules", import.meta.url), "utf8");

describe("Storage tenant isolation policy", () => {
  it("scopes customer documents to staff or the matching customer", () => {
    expect(rules).toContain("staff(orgId) || clientCustomer(orgId,customerId)");
    expect(rules).not.toContain("customers/{customerId}/{userId}/{allPaths=**} { allow read: if member(orgId)");
  });
  it("includes a project boundary in questionnaire uploads", () => {
    expect(rules).toContain("questionnaires/{projectId}/{questionnaireId}/{fieldId}/{userId}");
    expect(rules).toContain("staff(orgId) || clientProject(orgId,projectId)");
  });
  it("retains a default deny rule", () => {
    expect(rules).toContain("match /{allPaths=**} { allow read, write: if false; }");
  });
});
