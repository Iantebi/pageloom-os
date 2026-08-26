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
  it("keeps generated artifacts inside the matching project", () => {
    expect(rules).toContain("projects/{projectId}/artifacts/{allPaths=**}");
    expect(rules).toContain("staff(orgId) || clientProject(orgId,projectId)");
    expect(rules).toContain("artifacts/{allPaths=**} { allow read: if staff(orgId)");
    expect(rules).toContain("internal-artifacts/{allPaths=**} { allow read: if staff(orgId)");
  });
  it("retains a default deny rule", () => {
    expect(rules).toContain("match /{allPaths=**} { allow read, write: if false; }");
  });
  it("does not expose generated document and report storage directly",()=>{expect(rules).not.toContain("/documents/{allPaths=**}");expect(rules).not.toContain("/reports/{allPaths=**}");expect(rules).toContain("match /{allPaths=**} { allow read, write: if false; }")});
  it("isolates website media by customer, project, website and uploading user",()=>{expect(rules).toContain("website-media/{customerId}/{projectId}/{websiteId}/{userId}/{fileName}");expect(rules).toContain("clientCustomer(orgId,customerId) && clientProject(orgId,projectId)");expect(rules).toContain("request.auth.uid == userId");expect(rules).toContain("image/jpeg|image/png|image/webp|image/gif|video/mp4|video/webm")});
  it("denies disabled members and honors optional project assignments",()=>{expect(rules).toContain("data.disabled != true");expect(rules).toContain("'projectIds' in membership(orgId)");expect(rules).toContain("projectId in membership(orgId).projectIds")});
});
