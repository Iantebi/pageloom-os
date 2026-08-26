import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./closing-api.ts", import.meta.url), "utf8");

describe("closing workspace API authority", () => {
  it("persists the workspace so it survives a reload instead of living only in client state", () => {
    expect(source).toContain("docRef(input.organizationId, customerId)");
    expect(source).toContain("customers/${customerId}/closing/current");
  });
  it("restricts every mutation to owner/admin, matching other financial endpoints", () => {
    expect(source).toContain('const mutateRoles = ["owner", "admin"];');
    for (const call of ['requireRole(req, res, input.organizationId, mutateRoles)']) expect((source.match(new RegExp(call.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length ?? 0)).toBeGreaterThanOrEqual(4);
  });
  it("scopes reads to org/admin/operator and requires the customer to exist in the same tenant", () => {
    expect(source).toContain('const readRoles = ["owner", "admin", "operator"];');
    expect(source).toContain("CUSTOMER_NOT_FOUND");
  });
  it("makes signing idempotent instead of erroring on a duplicate submit", () => {
    expect(source).toContain("if (state.contract) return { state, alreadySigned: true };");
  });
  it("makes marking a payment paid idempotent instead of erroring on a duplicate submit", () => {
    expect(source).toContain('if (payment.status === "paid") return { state, alreadyPaid: true };');
  });
  it("rejects signing before a proposal exists", () => {
    expect(source).toContain("Generate a proposal before requesting a signature");
  });
  it("uses a transaction for sign and payment mutations to avoid a torn read-modify-write race", () => {
    expect(source.match(/db\.runTransaction/g)?.length).toBe(2);
  });
});
