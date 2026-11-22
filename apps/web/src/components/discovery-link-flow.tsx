"use client";
import { Suspense, useEffect, useState } from "react";
import { signInAnonymously } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { api } from "@/lib/api";
import { OrganizationProvider } from "@/lib/organization";
import { t } from "@/lib/i18n";
import { Loading } from "@/components/product-ui";
import AiStudioDiscovery from "@/ai-studio/App";

// The customer-facing entry point for a "New Client" Discovery link (functions/src/
// client-onboarding-api.ts's POST /discovery-links/:token/claim). Reached at a clean
// /d/{token} URL — see apps/web/src/app/page.tsx, which renders this instead of its usual
// dashboard redirect when the browser's real pathname matches /d/. This can't be a real
// Next.js dynamic route: the app is a static export (output: "export" in next.config.ts),
// which requires every dynamic segment's possible values to be known at build time — tokens
// are generated at runtime, so there's no way to pre-render them. Firebase Hosting's existing
// catch-all rewrite ("**": "/index.html") already serves this same root page for any
// unmatched path, so the token never has to be a registered route; it's just read from
// window.location by this component instead.
//
// No projectId/organizationId/customerId ever appears in the URL: the token is opaque, and the
// claim response's ids are only ever held in memory (React state), never written back to the
// address bar.
export function DiscoveryLinkFlow({ token }: { token: string }) {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [projectId, setProjectId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const s = t("discoveryLink");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!firebaseAuth.currentUser) await signInAnonymously(firebaseAuth);
        const result = await api<{ organizationId: string; projectId: string }>(`/discovery-links/${token}/claim`, { method: "POST" });
        if (!active) return;
        setProjectId(result.projectId);
        setPhase("ready");
      } catch (failure) {
        if (!active) return;
        setErrorMessage(failure instanceof Error ? failure.message : "");
        setPhase("error");
      }
    })();
    return () => { active = false; };
  }, [token]);

  if (phase === "loading") return <div className="grid min-h-screen place-items-center bg-[var(--bg)]"><Loading label={s.opening} /></div>;
  if (phase === "error") return <div className="grid min-h-screen place-items-center bg-[var(--bg)] p-6 text-center"><div className="max-w-sm"><p className="text-sm font-semibold text-[var(--text)]">{s.invalidTitle}</p><p className="mt-2 text-xs leading-6 text-[var(--muted)]">{errorMessage || s.invalidBody}</p></div></div>;
  return <OrganizationProvider><Suspense fallback={<Loading label={s.opening} />}><AiStudioDiscovery projectIdOverride={projectId} /></Suspense></OrganizationProvider>;
}
