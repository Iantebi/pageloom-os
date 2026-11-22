"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

// Registers /sw.js and, when a NEW version of it takes over an already-open tab, shows a small
// "update available" toast instead of silently reloading — a silent reload could wipe unsaved
// input mid-typing on a long form like Discovery. sw.js calls self.skipWaiting() + clients.claim()
// unconditionally, so the reliable signal for "a real update just happened" (not the very first
// activation on a fresh tab) is the `controllerchange` event firing after this tab already had a
// controller — see the `hadControllerOnMount` guard below.
export function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Registration is deliberately production-only: Next.js dev servers (both Turbopack and
    // webpack) reject it outright with a generic "unknown error fetching the script" before any
    // network request is even made — a well-known dev-mode limitation, not a real deployment
    // issue, and one Next.js's own HMR pipeline would conflict with anyway (a live service worker
    // intercepting fetches during development can break Fast Refresh). Installability is a
    // progressive enhancement regardless, so a rejection here should never surface as an error.
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    const hadControllerOnMount = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => { if (hadControllerOnMount) setUpdateAvailable(true); };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  if (!updateAvailable) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }} role="status">
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--text)] shadow-2xl">
        <span>גרסה חדשה של PageLoom זמינה.</span>
        <button onClick={() => window.location.reload()} className="button button-primary" style={{ paddingBlock: "6px" }}>
          <RefreshCw className="h-3.5 w-3.5" />
          רענון עכשיו
        </button>
      </div>
    </div>
  );
}
