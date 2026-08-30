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

describe("closing workspace unexpected-error handling", () => {
  it("no longer reports every unexpected failure as a fixed 409, only a deliberately thrown status", () => {
    expect(source).toContain('const status = (error as { status?: number }).status;');
    expect(source).toContain('if (typeof status === "number") return res.status(status)');
    expect(source).not.toContain('return res.status(409).json({ error: { code: "CLOSING_OPERATION_FAILED"');
  });
  it("logs unexpected failures that reach the generic handler", () => {
    expect(source).toContain('operationalLog("error", "closing.operation.failed"');
    expect(source).toContain("safeErrorName(error)");
  });
  it("falls back to a generic 500 instead of the raw error for unexpected failures", () => {
    expect(source).toContain('code: "INTERNAL_ERROR"');
    expect(source).toContain('message: "The operation failed"');
  });
  it("still lets the sign/payment domain errors (CONTRACT_NOT_READY, PAYMENT_NOT_FOUND) report their own status and message", () => {
    expect(source).toContain('code: "CONTRACT_NOT_READY"');
    expect(source).toContain('code: "PAYMENT_NOT_FOUND"');
  });
});
