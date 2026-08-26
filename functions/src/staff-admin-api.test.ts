import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./staff-admin-api.ts", import.meta.url), "utf8");

describe("staff admin API security", () => {
  it("requires owner/admin to invite or manage staff", () => {
    expect(source).toContain('requireRole(req, res, input.organizationId, ["owner", "admin"])');
  });
  it("only an Owner can grant or change Owner/Admin access", () => {
    expect(source).toContain("ESCALATION_DENIED");
    expect(source).toContain('actor.role !== "owner"');
  });
  it("refuses to let a staff member disable or demote their own account", () => {
    expect(source).toContain("SELF_CHANGE_DENIED");
    expect(source).toContain("uid === req.user!.uid");
  });
  it("never targets a customer portal user through the staff endpoints", () => {
    expect(source).toContain('member.data()?.role === "client"');
  });
  it("only claims a staff invitation for a verified email match", () => {
    expect(source).toContain("!identity.email || !identity.emailVerified");
    expect(source).toContain('current.data()?.status !== "pending"');
  });
  it("never allows a direct client write to staffInvitations", () => {
    expect(source).not.toContain("allow write");
  });
});
