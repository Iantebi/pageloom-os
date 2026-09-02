"use client";
import { useCallback, useEffect, useState } from "react";
import type { DiscoveryProgressDocument, DiscoverySectionDocument, DiscoverySectionId } from "@pageloom/core";
import { api } from "./api";

// Shared data-fetching for Business Discovery — used by the customer flow (app/discovery),
// the dashboard/portal task card, and the staff Backend Master panel.

export interface DiscoveryState {
  progress: DiscoveryProgressDocument | null;
  sections: Record<string, DiscoverySectionDocument>;
}

export function useDiscovery(organizationId: string | undefined, projectId: string | undefined) {
  const [state, setState] = useState<DiscoveryState>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // A promise-chain (not async/await) body deliberately keeps every setState call inside a .then/
  // .catch/.finally callback rather than synchronously in this function's immediate execution —
  // when called directly from the effect below, a synchronous setState there would trigger a
  // cascading render (react-hooks/set-state-in-effect).
  const reload = useCallback(() => {
    if (!organizationId || !projectId) return undefined;
    return api<DiscoveryState>(`/projects/${projectId}/discovery?organizationId=${encodeURIComponent(organizationId)}`)
      .then(result => { setState(result); setError(""); })
      .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : "load_failed"))
      .finally(() => setLoading(false));
  }, [organizationId, projectId]);

  useEffect(() => { void reload(); }, [reload]);

  return { state, loading, error, reload };
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export async function saveDiscoverySection(organizationId: string, projectId: string, sectionId: DiscoverySectionId, responses: Record<string, unknown>) {
  return api(`/projects/${projectId}/discovery/sections/${sectionId}`, { method: "PATCH", body: JSON.stringify({ organizationId, responses }) });
}

export async function completeDiscoverySection(organizationId: string, projectId: string, sectionId: DiscoverySectionId) {
  return api<{ id: string; status: string }>(`/projects/${projectId}/discovery/sections/${sectionId}/complete`, { method: "POST", body: JSON.stringify({ organizationId }) });
}

export async function submitDiscovery(organizationId: string, projectId: string) {
  return api<{ status: string; alreadySubmitted?: boolean }>(`/projects/${projectId}/discovery/submit`, { method: "POST", body: JSON.stringify({ organizationId }) });
}

export async function markDiscoveryReviewed(organizationId: string, projectId: string) {
  return api<{ status: string }>(`/projects/${projectId}/discovery/review`, { method: "POST", body: JSON.stringify({ organizationId }) });
}

export async function reopenDiscoverySection(organizationId: string, projectId: string, sectionId: DiscoverySectionId, reason: string) {
  return api(`/projects/${projectId}/discovery/sections/${sectionId}/reopen`, { method: "POST", body: JSON.stringify({ organizationId, reason }) });
}

export interface DiscoveryNote { id: string; projectId: string; sectionId?: DiscoverySectionId; authorId: string; authorName: string; body: string; createdAt: string }

export async function addDiscoveryNote(organizationId: string, projectId: string, body: string, sectionId?: DiscoverySectionId) {
  return api<DiscoveryNote>(`/projects/${projectId}/discovery/notes`, { method: "POST", body: JSON.stringify({ organizationId, body, ...(sectionId ? { sectionId } : {}) }) });
}

export async function loadDiscoveryNotes(organizationId: string, projectId: string) {
  return api<DiscoveryNote[]>(`/projects/${projectId}/discovery/notes?organizationId=${encodeURIComponent(organizationId)}`);
}
