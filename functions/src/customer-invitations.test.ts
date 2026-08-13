import {describe,expect,it} from "vitest";
import {invitationExpiresAt,invitationId,normalizeInvitationEmail} from "./customer-invitations.js";
describe("customer invitations",()=>{
  it("normalizes addresses before deriving stable ids",()=>{expect(normalizeInvitationEmail(" Owner@Example.COM ")).toBe("owner@example.com");expect(invitationId("customer-1"," Owner@Example.COM ")).toBe(invitationId("customer-1","owner@example.com"));expect(invitationId("customer-2","owner@example.com")).not.toBe(invitationId("customer-1","owner@example.com"))});
  it("expires after seven days",()=>expect(invitationExpiresAt(new Date("2026-08-13T00:00:00.000Z"))).toBe("2026-08-20T00:00:00.000Z"));
});
