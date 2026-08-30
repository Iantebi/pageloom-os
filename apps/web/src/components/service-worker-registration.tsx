"use client";
import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Registration is deliberately production-only: Next.js dev servers (both Turbopack and
    // webpack) reject it outright with a generic "unknown error fetching the script" before any
    // network request is even made — a well-known dev-mode limitation, not a real deployment
    // issue, and one Next.js's own HMR pipeline would conflict with anyway (a live service worker
    // intercepting fetches during development can break Fast Refresh). Installability is a
    // progressive enhancement regardless, so a rejection here should never surface as an error.
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
