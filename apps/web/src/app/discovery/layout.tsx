import { AuthenticatedOrganization } from "@/components/product-shell";

// A deliberately minimal, focused shell — no sidebar, no nav, no dashboard chrome. Business
// Discovery is a separate UX context from the rest of the product (mission's own instruction),
// so it gets its own top-level route with its own light layout rather than living inside
// (product)/layout.tsx's full ProductShell. See docs/customer-discovery-onboarding/UX-FLOW.md §4.
export default function DiscoveryLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedOrganization>
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">{children}</div>
  </AuthenticatedOrganization>;
}
