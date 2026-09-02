"use client";
import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/route-error-boundary";

// Root-level fallback for anything outside the (product) and discovery groups (currently just the
// "/" redirect-to-dashboard page). Each of those groups also has its own error.tsx so a crash there
// keeps that group's own layout mounted instead of falling back to this generic one.
export default function RootRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <RouteErrorFallback reset={reset} />;
}
