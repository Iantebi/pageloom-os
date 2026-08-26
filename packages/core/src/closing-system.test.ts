import { describe, expect, it } from "vitest";
import { acceptDigitalContract, createClosingProposal, customerTimeline, kickoffAutomation, markPaymentPaid, onboardingChecklist, ownerTasksAfterPayment, paymentSchedule } from "./closing-system.js";

const proposal = () => createClosingProposal({ customer: "Dana", business: "Dana Studio", packageId: "growth", challenge: "More qualified leads", validUntil: "2099-01-01" });

describe("customer closing system", () => {
  it("creates a priced proposal", () => {
    const value = proposal();
    expect(value.investment).toBe(12000);
    expect(value.deposit + value.balance).toBe(value.investment);
  });
  it("requires matching contract consent", () => {
    expect(acceptDigitalContract({ proposalId: "p1", customerName: "Dana", agreementVersion: "1.0", acceptedTerms: true, typedSignature: "Dana" }).acceptedAt).toBeTruthy();
    expect(() => acceptDigitalContract({ proposalId: "p1", customerName: "Dana", agreementVersion: "1.0", acceptedTerms: true, typedSignature: "Other" })).toThrow();
  });
  it("builds post-sale operations", () => {
    const schedule = paymentSchedule(proposal(), "2026-09-01");
    expect(markPaymentPaid(schedule[0]).status).toBe("paid");
    expect(onboardingChecklist()).toHaveLength(5);
    expect(kickoffAutomation("Dana Studio")).toHaveLength(4);
    expect(customerTimeline("2026-09-01", 5)).toHaveLength(5);
    expect(ownerTasksAfterPayment("Dana Studio").every(item => item.owner === "owner")).toBe(true);
  });
});

describe("closing system — missing/invalid data", () => {
  it("rejects a proposal for an unknown package", () => {
    expect(() => createClosingProposal({ customer: "Dana", business: "Dana Studio", packageId: "enterprise" as never, challenge: "x", validUntil: "2099-01-01" })).toThrow("Complete a valid proposal");
  });
  it("rejects a proposal with a blank customer, business, or challenge", () => {
    expect(() => createClosingProposal({ customer: "", business: "Dana Studio", packageId: "growth", challenge: "x", validUntil: "2099-01-01" })).toThrow();
    expect(() => createClosingProposal({ customer: "Dana", business: "  ", packageId: "growth", challenge: "x", validUntil: "2099-01-01" })).toThrow();
    expect(() => createClosingProposal({ customer: "Dana", business: "Dana Studio", packageId: "growth", challenge: "   ", validUntil: "2099-01-01" })).toThrow();
  });
  it("rejects a proposal that is already expired or expires this instant", () => {
    expect(() => createClosingProposal({ customer: "Dana", business: "Dana Studio", packageId: "growth", challenge: "x", validUntil: "2000-01-01" })).toThrow("Complete a valid proposal");
  });
  it("rejects contract acceptance without explicit terms consent even if the signature matches", () => {
    expect(() => acceptDigitalContract({ proposalId: "p1", customerName: "Dana", agreementVersion: "1.0", acceptedTerms: false, typedSignature: "Dana" })).toThrow();
  });
  it("rejects contract acceptance against a malformed agreement version", () => {
    expect(() => acceptDigitalContract({ proposalId: "p1", customerName: "Dana", agreementVersion: "v1", acceptedTerms: true, typedSignature: "Dana" })).toThrow();
  });
  it("treats the signature comparison as exact after trimming, not case-insensitive", () => {
    expect(acceptDigitalContract({ proposalId: "p1", customerName: " Dana ", agreementVersion: "1.0", acceptedTerms: true, typedSignature: "Dana" }).typedSignature).toBe("Dana");
    expect(() => acceptDigitalContract({ proposalId: "p1", customerName: "Dana", agreementVersion: "1.0", acceptedTerms: true, typedSignature: "dana" })).toThrow();
  });
  it("rejects a payment schedule with an invalid start date", () => {
    expect(() => paymentSchedule(proposal(), "not-a-date")).toThrow("Valid payment start date required");
  });
  it("rejects a customer timeline with an invalid start date or a non-positive week count", () => {
    expect(() => customerTimeline("not-a-date", 5)).toThrow("Valid timeline required");
    expect(() => customerTimeline("2026-09-01", 0)).toThrow("Valid timeline required");
  });
  it("rejects kickoff automation for a blank customer name", () => {
    expect(() => kickoffAutomation("   ")).toThrow("Customer required");
  });
});

describe("closing system — state transitions and duplicate actions", () => {
  it("computes a deterministic payment schedule: deposit due at kickoff, balance due after the project timeline", () => {
    const value = proposal();
    const [deposit, balance] = paymentSchedule(value, "2026-09-01T00:00:00.000Z");
    expect(deposit.dueAt).toBe("2026-09-01T00:00:00.000Z");
    expect(new Date(balance.dueAt).getTime() - new Date(deposit.dueAt).getTime()).toBe(value.package.timelineWeeks * 7 * 86_400_000);
    expect(deposit.status).toBe("pending");
    expect(balance.status).toBe("pending");
  });
  it("marking an already-paid payment paid again is a harmless no-op that keeps it paid", () => {
    const [deposit] = paymentSchedule(proposal(), "2026-09-01");
    const once = markPaymentPaid(deposit);
    const twice = markPaymentPaid(once);
    expect(once.status).toBe("paid");
    expect(twice.status).toBe("paid");
    expect(once.id).toBe(twice.id);
  });
  it("does not mutate the original payment when marking it paid", () => {
    const [deposit] = paymentSchedule(proposal(), "2026-09-01");
    const paid = markPaymentPaid(deposit);
    expect(deposit.status).toBe("pending");
    expect(paid).not.toBe(deposit);
  });
  it("only unlocks owner post-payment tasks conceptually after a deposit is paid (caller-driven gate)", () => {
    // The pure function itself always returns the task list — the caller (API/UI) is
    // responsible for only calling it once payments.some(deposit paid) is true.
    // This test documents that contract so a future change here is deliberate.
    expect(ownerTasksAfterPayment("Dana Studio").map(item => item.id)).toContain("receipt");
  });
  it("produces a fixed five-item onboarding checklist that starts fully incomplete", () => {
    expect(onboardingChecklist().every(item => item.complete === false)).toBe(true);
    expect(onboardingChecklist().map(item => item.id)).toEqual(["contract", "deposit", "questionnaire", "assets", "kickoff"]);
  });
});
