import { describe, expect, it } from "vitest";
import { createFinancialRecordSchema, supportDueAt, updateSupportTicketSchema } from "./operations.js";

describe("operational records", () => {
  it("validates auditable financial entries", () => expect(createFinancialRecordSchema.parse({ organizationId: "org", amount: 100, currency: "ILS", occurredAt: "2026-08-17T00:00:00.000Z", category: "project", description: "Deposit received" }).amount).toBe(100));
  it("requires resolution evidence to resolve support", () => expect(updateSupportTicketSchema.safeParse({ organizationId: "org", status: "resolved" }).success).toBe(false));
  it("derives deterministic response deadlines", () => expect(supportDueAt("critical", "2026-08-17T00:00:00.000Z")).toBe("2026-08-17T01:00:00.000Z"));
});
