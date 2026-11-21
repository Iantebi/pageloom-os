"use client";
import { Suspense } from "react";
import AiStudioDiscovery from "@/ai-studio/App";
import { Loading } from "@/components/product-ui";

// The Google AI Studio Discovery frontend, wired to the real, already-deployed Discovery backend
// (functions/src/discovery-api.ts) — see apps/web/src/ai-studio/services/discoveryMapping.ts for
// the field-level bridge. Suspense is required here (not inside App.tsx) because App.tsx calls
// useSearchParams(), which Next's App Router only allows under a Suspense boundary.
export default function DiscoveryPage() {
  return <Suspense fallback={<Loading />}><AiStudioDiscovery /></Suspense>;
}
