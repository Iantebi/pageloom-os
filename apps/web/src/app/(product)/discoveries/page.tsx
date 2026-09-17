"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, Search, ExternalLink, UserPlus, LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useOrganization } from "@/lib/organization";
import { t } from "@/lib/i18n";
import { Button, Card, Empty, Loading, PageHeader, Status, dateTime, number } from "@/components/product-ui";

// Owner Workspace "Discovery" section (2026-09-17 nav unification) — a dedicated, searchable,
// filterable view over every Discovery session org-wide. Reuses the existing staff-only
// GET /discovery/management/sessions endpoint (also used by DiscoveryManagementList on
// /dashboard and /master) rather than a new backend read; this page adds the search/filter UI and
// the two actions that endpoint's compact list widgets don't have room for: opening the full
// questionnaire (deep-links to the onboarding tab on /projects/view, where DiscoveryPanel already
// renders every real per-section answer) and converting an orphan project (no customerId) into a
// real customer record.

type ManagementSession = {
  id: string; customerId: string | null; projectName: string; businessName: string; ownerName: string | null;
  status: string; percentComplete: number; currentSectionId: string | null;
  startedAt: string | null; submittedAt: string | null; lastActivityAt: string;
};

const draftStatuses = new Set(["not_started", "in_progress", "reopened"]);

export default function DiscoveriesPage() {
  const s = t("discoveriesPage");
  const { organizationId, membership } = useOrganization();
  const isStaff = membership?.role === "owner" || membership?.role === "admin" || membership?.role === "operator";
  const [sessions, setSessions] = useState<ManagementSession[]>();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [converting, setConverting] = useState<string>();
  const [message, setMessage] = useState("");

  const load = useCallback(() => {
    if (!organizationId) return;
    setError("");
    api<ManagementSession[]>(`/discovery/management/sessions?organizationId=${encodeURIComponent(organizationId)}`)
      .then(setSessions)
      .catch(failure => setError(failure instanceof Error ? failure.message : s.loadErrorFallback));
  }, [organizationId, s.loadErrorFallback]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const list = sessions ?? [];
    const value = query.trim().toLowerCase();
    return list
      .filter(session => statusFilter === "all" || session.status === statusFilter)
      .filter(session => !value || [session.businessName, session.ownerName, session.projectName, session.id].some(field => field?.toLowerCase().includes(value)));
  }, [sessions, query, statusFilter]);

  async function convertToCustomer(session: ManagementSession) {
    if (!organizationId) return;
    setConverting(session.id);
    setMessage("");
    try {
      await api(`/admin/discovery-sessions/${session.id}/convert-to-customer`, { method: "POST", body: JSON.stringify({ organizationId }) });
      setMessage(s.convertSuccess);
      load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : s.convertErrorFallback);
    } finally {
      setConverting(undefined);
    }
  }

  if (!isStaff) return <Card><Empty title={t("common").adminRequiredTitle} description={t("common").adminRequiredDescription} /></Card>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={s.eyebrow}
        title={s.title}
        description={s.description}
        actions={<button className="top-icon" onClick={load} aria-label={s.refreshAria}><RefreshCw className="h-4 w-4" /></button>}
      />
      {message && <p className="notice notice-success" role="status">{message}</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <label className="field flex-1 min-w-[220px]">
            <span className="sr-only">{s.searchPlaceholder}</span>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input className="input ps-9" value={query} onChange={e => setQuery(e.target.value)} placeholder={s.searchPlaceholder} />
            </div>
          </label>
          <select className="input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">{s.filterAllLabel}</option>
            {["not_started", "in_progress", "submitted", "reviewed", "reopened"].map(status => (
              <option key={status} value={status}>{(t("statusLabels") as Record<string, string>)[status] ?? status}</option>
            ))}
          </select>
          <span className="text-[10px] text-[var(--muted)]">{s.resultsCount(filtered.length)}</span>
        </div>

        {sessions === undefined && !error && <Loading />}

        {sessions !== undefined && filtered.length === 0 && <Empty title={s.emptyTitle} description={s.emptyDescription} />}

        {filtered.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  <th className="p-2 text-start">{s.columnBusiness}</th>
                  <th className="p-2 text-start">{s.columnStatus}</th>
                  <th className="p-2 text-start">{s.columnProgress}</th>
                  <th className="p-2 text-start">{s.columnLastActivity}</th>
                  <th className="p-2 text-start">{s.columnActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map(session => (
                  <tr key={session.id}>
                    <td className="p-2">
                      <b className="block text-[11px]">{session.businessName}</b>
                      <small className="text-[9px] text-[var(--muted)]">{session.ownerName ?? s.noOwnerName} · #{session.id}</small>
                    </td>
                    <td className="p-2"><Status value={session.status} /></td>
                    <td className="p-2 text-[10px]">{number(session.percentComplete)}%</td>
                    <td className="p-2 text-[10px] text-[var(--muted)]">{dateTime(session.lastActivityAt)}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link className="button button-secondary" href={`/projects/view?id=${session.id}&tab=onboarding`}>
                          <ExternalLink className="h-3.5 w-3.5" />
                          {draftStatuses.has(session.status) ? s.continueDraft : s.openQuestionnaire}
                        </Link>
                        {!session.customerId && (
                          <Button variant="secondary" disabled={converting === session.id} onClick={() => void convertToCustomer(session)}>
                            {converting === session.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                            {converting === session.id ? s.converting : s.convertToCustomer}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
