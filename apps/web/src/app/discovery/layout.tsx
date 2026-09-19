import { AuthenticatedOrganization } from "@/components/product-shell";

// A deliberately minimal, focused shell — no sidebar, no nav, no dashboard chrome. Business
// Discovery is a separate UX context from the rest of the product, so it gets its own top-level
// route with its own light layout rather than living inside (product)/layout.tsx's full
// ProductShell. AuthenticatedOrganization still gates it (real auth + real organization context —
// see apps/web/src/ai-studio/App.tsx, which reads organizationId from useOrganization()).
export default function DiscoveryLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedOrganization>
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">{children}</div>
  </AuthenticatedOrganization>;
}
