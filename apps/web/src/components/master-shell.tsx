"use client";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { AuthenticatedOrganization } from "./product-shell";
import { useAuth } from "@/lib/auth";
import { useOrganization } from "@/lib/organization";
import { t } from "@/lib/i18n";
import { Card, Empty } from "./product-ui";

// Backend Master Control Center — a deliberately SEPARATE application from the Owner Workspace
// (see the 2026-09-17 architecture rule: "the Owner Workspace and the Backend Master Control
// Center are two completely separate applications... each must have its own navigation, routes,
// permissions, layout and responsibilities. The Owner Workspace must never expose Backend Master
// controls."). This shell intentionally does NOT reuse ProductShell/Shell's 7-item sidebar — it
// only reuses AuthenticatedOrganization for the auth/org gate those two apps both still need, and
// then renders its own minimal, visually distinct chrome (no shared nav, no shared widgets like
// RoleScopedExtras or DashboardDiscoverySlot, which are (product)-layout-only). The only link
// between the two is this bar's "exit" link BACK to the Owner Workspace, which is not a Master
// control being exposed inside the Owner Workspace — it's the one-way door out of Master.
export function MasterShell({ children }: { children: React.ReactNode }) {
  return <AuthenticatedOrganization><Gate>{children}</Gate></AuthenticatedOrganization>;
}

function Gate({ children }: { children: React.ReactNode }) {
  const { membership } = useOrganization();
  const { signOut } = useAuth();
  const c = t("common");
  const isPlatformAdmin = membership?.role === "owner" || membership?.role === "admin";

  if (!isPlatformAdmin) {
    return <div className="grid min-h-screen place-items-center bg-[var(--bg)] p-6"><Card className="max-w-sm"><Empty title={c.adminRequiredTitle} description={c.adminRequiredDescription} /></Card></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="flex h-14 items-center justify-between border-b border-white/8 px-4">
        <span className="flex items-center gap-2 text-xs font-semibold">
          <ShieldCheck className="h-4 w-4" />
          PageLoom · Backend Master
        </span>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="button button-secondary">{c.exitToOwnerWorkspace}</Link>
          <button onClick={() => void signOut()} className="top-icon" aria-label={c.signOut}><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
      <main className="product-main">{children}</main>
    </div>
  );
}
