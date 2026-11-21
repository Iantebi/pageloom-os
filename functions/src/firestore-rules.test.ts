import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";const rules=readFileSync(new URL("../../firestore.rules",import.meta.url),"utf8");describe("Firestore enterprise isolation",()=>{it("keeps all client writes server-authorized",()=>expect(rules).not.toContain("allow write: if client"));it("limits customer document reads by project and audience while signatures remain staff-only",()=>{expect(rules).toContain("clientProject(orgId, projectId) && resource.data.audience == 'customer'");expect(rules).toContain("documents/{documentId}/signatures/{signatureId} { allow read: if staff(orgId)")});it("limits client support reads to their customer account",()=>expect(rules).toContain("client(orgId) && resource.data.customerId == clientCustomerId(orgId)"));it("retains recursive default deny",()=>expect(rules).toContain("match /{document=**} { allow read, write: if false; }"))});
describe("Firestore role least-privilege",()=>{
  const privilegedOnly=["revenue","expenses","agentSettings","infrastructurePlans","backupRuns","domains","certificates","fleetResources","incidents","alerts","securityEvents","deadLetters","executions","apiKeys","secrets","auditLogs","scheduledJobs","maintenanceRequests","reviews","pricingPackages","legalDocuments"];
  it("defines a privileged() role tier excluding organization members without an elevated role",()=>{expect(rules).toContain("function privileged(orgId)");expect(rules).toContain("platformAdmin() || (member(orgId) && role(orgId) in ['owner','admin','operator'])");expect(rules).not.toContain("role(orgId) in ['owner','admin','operator','member']); }\n    function client")});
  for(const collection of privilegedOnly){it(`restricts /${collection} to privileged() and not the broad staff() wildcard`,()=>{expect(rules).toContain(`match /${collection}/{docId} { allow read: if privileged(orgId); allow write: if false; }`);expect(rules).not.toMatch(new RegExp(`match /${collection}/\\{docId\\} \\{ allow read: if staff\\(orgId\\)`))})}
  it("does not use a generic wildcard collection match that would OR-override the privileged tier",()=>expect(rules).not.toContain("match /{collection}/{docId}"));
  it("restricts draft/undecided legal acceptances to privileged staff",()=>expect(rules).toContain("match /projects/{projectId}/legalAcceptances/{acceptanceId} { allow read: if privileged(orgId); allow write: if false; }"));
});
describe("website content isolation",()=>{it("keeps raw website content staff-only (customers use the /website-content API) and all writes server-authorized",()=>{expect(rules).toContain("match /websites/{websiteId}/content/{contentId} { allow read: if staff(orgId); allow write: if false; }");expect(rules).not.toMatch(/content\/\{contentId\} \{[^}]*client/);expect(rules).not.toContain("content/{contentId} { allow write")});it("keeps content revision history privileged",()=>expect(rules).toContain("contentRevisions/{revisionId} { allow read: if privileged(orgId); allow write: if false; }"))});
describe("customer access lifecycle",()=>{it("denies disabled members and honors optional project assignments",()=>{expect(rules).toContain("data.disabled != true");expect(rules).toContain("'projectIds' in get(");expect(rules).toContain("projectId in get(")});it("treats an empty projectIds list as unrestricted, not as a deny-all list",()=>expect(rules).toContain(".data.projectIds.size() == 0 ||"))});
describe("platform administrators",()=>{it("uses an immutable Firebase claim for cross-organization read access, read via get() so a token without the claim evaluates false instead of throwing",()=>{expect(rules).toContain("request.auth.token.get('platformRole', null) in ['owner','admin']");expect(rules).toContain("function staff(orgId) { return platformAdmin()")});it("keeps content submissions server-write-only",()=>expect(rules).toContain("contentSubmissions/{submissionId} { allow read: if privileged(orgId); allow write: if false; }"))});
describe("staff invitations and support internal notes",()=>{it("restricts pending staff invitations to privileged staff and denies direct writes",()=>{expect(rules).toContain("match /staffInvitations/{docId} { allow read: if privileged(orgId); allow write: if false; }")});it("keeps support ticket internal notes staff-only, never client-readable",()=>{expect(rules).toContain("match /supportTickets/{ticketId}/internalNotes/{noteId} { allow read: if staff(orgId); allow write: if false; }")})});
describe("Business Discovery isolation",()=>{
  it("lets staff or the assigned client read discovery sections and progress, with no client write path",()=>{
    expect(rules).toContain("match /projects/{projectId}/discovery/{sectionId} { allow read: if staff(orgId) || clientProject(orgId, projectId); allow write: if false; }");
    expect(rules).toContain("match /projects/{projectId}/discoveryProgress/{docId} { allow read: if staff(orgId) || clientProject(orgId, projectId); allow write: if false; }");
  });
  it("keeps discoveryNotes staff-only with NO clientProject() clause — customers must never read internal notes",()=>{
    expect(rules).toContain("match /projects/{projectId}/discoveryNotes/{noteId} { allow read: if staff(orgId); allow write: if false; }");
    expect(rules).not.toMatch(/discoveryNotes\/\{noteId\} \{ allow read: if staff\(orgId\) \|\|/);
  });
  it("keeps businessProfile staff-only at launch (unpopulated, internal AI-analysis destination)",()=>{
    expect(rules).toContain("match /projects/{projectId}/businessProfile/{docId} { allow read: if staff(orgId); allow write: if false; }");
  });
});
describe("raw project documents are staff-only (H1, 2026-11-16 audit)",()=>{
  // Raw project documents hold financial and internal fields (budget, revenue, cost, notes).
  // Customers read a server-projected allow-list of fields via GET /api/portal/projects
  // (functions/src/portal-projects-api.ts) instead of the raw document.
  it("removes clientProjectList and any client get/list on the top-level projects match",()=>{
    expect(rules).not.toContain("function clientProjectList");
    expect(rules).not.toContain("clientProjectList(orgId)");
    expect(rules).toContain("match /projects/{projectId} { allow read: if staff(orgId); allow write: if false; }");
    expect(rules).not.toMatch(/match \/projects\/\{projectId\} \{[^}]*clientProject\(/);
  });
  it("keeps staff read access, and keeps clientProject (with its full projectIds enforcement) for fixed-path subcollections",()=>{
    expect(rules).toContain("function staff(orgId) { return platformAdmin() || (member(orgId) && role(orgId) in ['owner','admin','operator','member']); }");
    expect(rules).toContain("function clientProject(orgId, projectId)");
    expect(rules).toContain("'projectIds' in get(");
    expect(rules).toContain("projectId in get(");
    expect(rules).toContain("match /projects/{projectId}/comments/{commentId} { allow read: if staff(orgId) || clientProject(orgId, projectId); allow write: if false; }");
  });
});
