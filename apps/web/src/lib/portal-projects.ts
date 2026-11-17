"use client";
import { useEffect, useState } from "react";
import type { Project } from "@pageloom/core";
import { api } from "./api";

export type PortalProject = Pick<Project, "id" | "organizationId" | "name" | "clientName" | "status" | "journeyStage" | "workflowStage" | "workflowStatus" | "locale" | "progress" | "customerApprovedAt" | "updatedAt" | "deadline" | "blockedReason"> & { websiteUrl?: string };

export type PortalProjectsState = { data: PortalProject[]; loading: boolean; error?: string };

export function usePortalProjects(organizationId: string | undefined, identityKey: string): PortalProjectsState {
  const [state, setState] = useState<PortalProjectsState & { key: string }>({ key: "", data: [], loading: true });
  const key = `${organizationId ?? ""}:${identityKey}`;
  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const data = await api<PortalProject[]>(`/portal/projects?organizationId=${encodeURIComponent(organizationId!)}`);
        if (active) setState({ key, data, loading: false });
      } catch (error) {
        // Clear prior customer data on a revoked membership or any request failure.
        if (active) setState({ key, data: [], loading: false, error: error instanceof Error ? error.message : "Request failed" });
      } finally { if (active) timer = setTimeout(() => void refresh(), 30_000); }
    }
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [organizationId, key]);
  return state.key === key ? state : { data: [], loading: Boolean(organizationId) };
}
