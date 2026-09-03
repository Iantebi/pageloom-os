"use client";
import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/route-error-boundary";

// Same contained-crash safety net as (product)/error.tsx, scoped to the Business Discovery flow's
// own minimal layout (see discovery/layout.tsx).
export default function DiscoveryRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <RouteErrorFallback reset={reset} />;
}
