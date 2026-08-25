export type WhatsAppStep = { id: "first" | "follow_up_1" | "follow_up_2" | "close_loop"; delayDays: number; purpose: string; message: string };
export type OutreachContext = { firstName: string; businessName: string; observation: string; bookingUrl: string };
const clean = (value: string) => value.trim().replace(/\s+/g, " ");

export function buildWhatsAppOutreach(context: OutreachContext): WhatsAppStep[] {
  const firstName = clean(context.firstName), businessName = clean(context.businessName), observation = clean(context.observation), bookingUrl = clean(context.bookingUrl);
  if (!firstName || !businessName || !observation || !bookingUrl) throw new Error("Complete all outreach fields");
  return [
    { id: "first", delayDays: 0, purpose: "Start a relevant conversation", message: `Hi ${firstName}, I had a look at ${businessName} and noticed ${observation}. We help businesses turn that kind of opportunity into a clear, conversion-focused website. Would a quick 15-minute chat be useful?` },
    { id: "follow_up_1", delayDays: 2, purpose: "Add value without pressure", message: `Hi ${firstName}, following up with one practical thought: the fastest win for ${businessName} is to make the next customer action unmistakable on every key page. I can show you what that could look like in 15 minutes: ${bookingUrl}` },
    { id: "follow_up_2", delayDays: 5, purpose: "Offer a concrete outcome", message: `Hi ${firstName}, I put aside a short slot to map the highest-impact website improvements for ${businessName}. No long presentation—just priorities, timing, and a realistic package. You can choose a time here: ${bookingUrl}` },
    { id: "close_loop", delayDays: 9, purpose: "Close the no-response loop respectfully", message: `Hi ${firstName}, I’ll close the loop for now so I don’t crowd your WhatsApp. If improving ${businessName}’s website becomes a priority, reply “website” and I’ll send the next steps.` },
  ];
}

export type SalesPackage = { id: "launch" | "growth" | "authority"; name: string; price: number; depositPercent: number; timelineWeeks: number; idealFor: string; outcomes: readonly string[] };
export const salesPackages: readonly SalesPackage[] = [
  { id: "launch", name: "Launch", price: 6500, depositPercent: 50, timelineWeeks: 3, idealFor: "A focused service business that needs a credible conversion-ready presence", outcomes: ["Up to 5 conversion-focused pages", "Mobile optimization", "Lead capture and analytics setup"] },
  { id: "growth", name: "Growth", price: 12000, depositPercent: 50, timelineWeeks: 5, idealFor: "A growing business that needs positioning, content, and a complete lead journey", outcomes: ["Strategy and messaging", "Up to 10 custom pages", "SEO, analytics, and CRM-ready lead capture"] },
  { id: "authority", name: "Authority", price: 22000, depositPercent: 40, timelineWeeks: 8, idealFor: "An established brand that needs a premium content and conversion platform", outcomes: ["Premium content system", "Advanced integrations", "90-day optimization plan"] },
];
export type ProposalContext = { prospectName: string; businessName: string; challenge: string; packageId: SalesPackage["id"]; validUntil: string };
export function generateProposal(context: ProposalContext): string { const selected = salesPackages.find(item => item.id === context.packageId); if (!selected || !context.prospectName.trim() || !context.businessName.trim() || !context.challenge.trim()) throw new Error("Complete the proposal details"); return [`PageLoom proposal for ${context.businessName}`, `Prepared for ${context.prospectName}`, "", `Priority: ${context.challenge.trim()}`, `Recommended package: ${selected.name}`, `Investment: ₪${selected.price.toLocaleString("en-US")}`, `Delivery target: ${selected.timelineWeeks} weeks`, "", "Included outcomes:", ...selected.outcomes.map(item => `• ${item}`), "", `Valid until: ${context.validUntil}`, "Next step: select the package and confirm the kickoff call."].join("\n"); }
export type SalesLeadMetric = { status: string; value: number; nextCallAt?: string };
export function calculateSalesMetrics(leads: readonly SalesLeadMetric[], now = new Date()) { const won = leads.filter(lead => lead.status === "won"); return { leads: leads.length, calls: leads.filter(lead => lead.nextCallAt && new Date(lead.nextCallAt) >= now).length, conversionRate: leads.length ? Math.round((won.length / leads.length) * 100) : 0, revenue: won.reduce((sum, lead) => sum + lead.value, 0) }; }
