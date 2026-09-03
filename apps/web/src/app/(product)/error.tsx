"use client";
import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/route-error-boundary";

// Catches a render/data-loading crash in any (product) route's page.tsx (dashboard, projects,
// projects/view, agents, builder, crm, portal, settings, master, master/content, master/customer)
// and shows a retry UI instead of the whole page going blank - the sidebar/nav above it (rendered
// by (product)/layout.tsx) stays mounted since error.tsx wraps only {children}, not the layout.
export default function ProductRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <RouteErrorFallback reset={reset} />;
}
