import { z } from "zod";

// Standalone "New Client" onboarding (2026-09-20) — deliberately independent of the CRM
// (client-management.ts's createCustomerSchema/createProjectSchema, which require a lead,
// industry, deal evidence, etc.) and of Backend Master. An Owner who wants to onboard a
// paying customer directly — no lead, no deal-closing ceremony — fills in exactly these four
// fields; everything else (customer record, project record, Discovery session, secure
// Discovery link) is created automatically. See docs/client-playbook/02-create-client.md.
export const createClientSchema = z.object({
  organizationId: z.string().min(1),
  businessName: z.string().min(2).max(200),
  contactName: z.string().min(2).max(200),
  email: z.string().email(),
  phone: z.string().min(5).max(30),
  notes: z.string().max(5000).optional(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

// A discoveryInvites/{token} document. Lives at the top level (not nested under
// organizations/{orgId}) because resolving a link must work before the caller's organization
// is known — the token itself is the only thing a brand-new customer's browser has. Never
// client-readable (see firestore.rules); every access goes through the claim endpoint, which
// runs before the rest of the API's authenticate middleware since the customer has no Firebase
// session yet when they first open the link.
export interface DiscoveryInvite {
  token: string;
  organizationId: string;
  customerId: string;
  projectId: string;
  createdAt: string;
  createdBy: string;
  claimedUid?: string;
  claimedAt?: string;
}
