import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";
const source=readFileSync(new URL("./platform-master-api.ts",import.meta.url),"utf8"),auth=readFileSync(new URL("./auth.ts",import.meta.url),"utf8");
describe("platform master control API",()=>{it("requires an explicit platform administrator boundary",()=>{expect(source).toContain("requirePlatformAdmin");expect(auth).toContain("systemAdministrators");expect(auth).toContain("platformRole");expect(source).not.toContain("requireRole(req,res")});it("covers every master control domain",()=>{for(const field of["customerInfrastructure","websiteFactory","business","operations","security","support","intelligence","searchable"])expect(source).toContain(field)});it("keeps customer infrastructure correlated by organization",()=>{expect(source).toContain("organizationId:organization.id");expect(source).toContain("healthScore")});it("provides one protected cross-organization support queue",()=>{expect(source).toContain('/platform/support-tickets');expect(source).toContain('requirePlatformAdmin(req,res)')});
// Regression: the daily Firestore export writes its status to systemOperations/backups/runs/{id}
// (see backup.ts), never to any organization's "backupRuns" subcollection - that field exists in
// the schema but nothing ever writes to it. Deriving backupStatus from it alone always showed
// "degraded" on the MASTER dashboard regardless of the real backup's actual health (found via a
// live production audit 2026-08-31: dashboard showed "degraded" while backups were confirmed
// healthy). This guards against silently reintroducing that disconnect.
it("derives backup status from the real backup run record, not only the unused organization-scoped collection",()=>{expect(source).toContain('db.collection("systemOperations/backups/runs")');expect(source).toContain("latestBackupRun")});
it("does not fabricate infrastructure metrics it cannot actually verify",()=>{expect(source).not.toContain('firestoreStatus:"operational"');expect(source).not.toMatch(/cloudFunctions:\s*\d/)})});
