"use client";
import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

// Owner Workspace only (see the 2026-09-18 Owner-Workspace/Backend-Master separation rule) — this
// never mounts inside master-shell.tsx. Real installability (manifest + service worker) already
// works without this component; it only adds the UI trigger a store-less PWA otherwise lacks —
// Chrome/Edge/Android suppress their own mini-infobar unless the app calls the captured
// `beforeinstallprompt` event itself, and iOS Safari never fires that event at all (Apple's install
// path is manual: Share -> Add to Home Screen), so both need an explicit prompt here.
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "pageloom-install-prompt-dismissed";

// Computed once, synchronously, as lazy useState initializers — not inside a useEffect — since
// they only read already-available browser APIs (no async work) and Next's static export still
// renders this "use client" component once at build time, where window/navigator don't exist.
function computeIsStandalone() {
  if (typeof window === "undefined") return true;
  try { return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true; } catch { return true; }
}
function computeDismissed() {
  if (typeof window === "undefined") return true;
  try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}
function computeIsIOS() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
}

export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent>();
  const [isStandalone, setIsStandalone] = useState(computeIsStandalone);
  const [dismissed, setDismissed] = useState(computeDismissed);
  const [isIOS] = useState(computeIsIOS);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => { event.preventDefault(); setDeferredEvent(event as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    const onInstalled = () => setIsStandalone(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onBeforeInstall); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  function dismiss() {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* per-viewer convenience only — fine if it doesn't persist */ }
  }

  async function install() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    if (outcome === "accepted") setIsStandalone(true);
    setDeferredEvent(undefined);
  }

  if (isStandalone || dismissed || (!deferredEvent && !isIOS)) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3 text-xs text-[var(--text)]">
      {deferredEvent ? (
        <>
          <Download className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span className="flex-1">התקינו את PageLoom OS כאפליקציה — גישה מהירה ישירות מהמסך הראשי או שולחן העבודה.</span>
          <button onClick={() => void install()} className="button button-primary">התקנה</button>
        </>
      ) : (
        <>
          <Share className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span className="flex-1">להתקנה על ה-iPhone/iPad: הקישו על כפתור השיתוף בדפדפן, ואז &quot;הוסף למסך הבית&quot;.</span>
        </>
      )}
      <button onClick={dismiss} aria-label="סגירה" className="text-[var(--muted)]"><X className="h-4 w-4" /></button>
    </div>
  );
}
