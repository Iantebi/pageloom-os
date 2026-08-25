import { describe, expect, it } from "vitest";
import { buildWhatsAppOutreach, calculateSalesMetrics, generateProposal } from "./sales-enablement.js";
describe("WhatsApp sales outreach", () => {
  it("creates the first-message, follow-up, and no-response sequence", () => {
    const flow = buildWhatsAppOutreach({ firstName: "Noga", businessName: "Noga Studio", observation: "the mobile CTA is difficult to find", bookingUrl: "https://cal.example/isaac" });
    expect(flow.map(step => step.id)).toEqual(["first", "follow_up_1", "follow_up_2", "close_loop"]);
    expect(flow.map(step => step.delayDays)).toEqual([0, 2, 5, 9]);
    expect(flow.every(step => step.message.includes("Noga"))).toBe(true);
  });
  it("refuses incomplete context", () => expect(() => buildWhatsAppOutreach({ firstName: "", businessName: "Studio", observation: "No CTA", bookingUrl: "https://cal.example" })).toThrow("Complete all outreach fields"));
});
describe("sales flow", () => {
  it("publishes complete packages with deposits and positioning", async () => { const { salesPackages } = await import("./sales-enablement.js"); expect(salesPackages.every(item => item.depositPercent > 0 && item.idealFor && item.outcomes.length === 3)).toBe(true); });
  it("generates a package-specific proposal", () => expect(generateProposal({ prospectName: "Dana", businessName: "Studio", challenge: "Increase qualified inquiries", packageId: "growth", validUntil: "2026-09-01" })).toContain("Recommended package: Growth"));
  it("calculates pipeline metrics", () => expect(calculateSalesMetrics([{ status: "won", value: 12000 }, { status: "qualified", value: 8000, nextCallAt: "2026-09-01T09:00:00Z" }], new Date("2026-08-19T00:00:00Z"))).toEqual({ leads: 2, calls: 1, conversionRate: 50, revenue: 12000 }));
});
