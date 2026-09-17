"use client";
import Link from "next/link";
import { RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useOrganization } from "@/lib/organization";
import { Button, Card, CardHeader, Empty, Status, dateTime } from "@/components/product-ui";

// Owner Dashboard / Master Panel Discovery list (2026-09-17 unification) — every project in the
// org that has any Discovery progress, most recently active first. Clicking a row opens
// /master/customer, where the existing DiscoveryPanel (embedded there since 2026-09-16) already
// shows that project's full, section-by-section answers — this list does not duplicate that view,
// it's the missing "browse all of them" entry point into it.
type DiscoverySession = {
  id: string; customerId: string | null; projectName: string; status: string;
  percentComplete: number; submittedAt: string | null; lastActivityAt: string;
};

export function DiscoveryManagementList({ compact = false }: { compact?: boolean }) {
  const [sessions, setSessions] = useState<DiscoverySession[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { organizationId } = useOrganization();

  // No synchronous setState here — only inside .then()/.catch()/.finally() — so the mount effect
  // below can call this directly. The refresh button's onClick (a real event handler, not an
  // effect) is what sets `loading` synchronously before calling this.
  const load = useCallback(() => {
    if (!organizationId) return;
    return api<DiscoverySession[]>(`/discovery/management/sessions?organizationId=${encodeURIComponent(organizationId)}`)
      .then(result => { setError(""); setSessions(result); })
      .catch(failure => setError(failure instanceof Error ? failure.message : "Could not load Discovery sessions"))
      .finally(() => setLoading(false));
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);
  const refresh = () => { setLoading(true); void load(); };

  const rows = (sessions ?? []).slice(0, compact ? 5 : 50);
  return <Card>
    <CardHeader
      icon={Sparkles} title="Business Discovery" subtitle="Every project's Discovery progress, most recently active first"
      action={<Button variant="secondary" className="min-h-9" onClick={refresh} disabled={loading} aria-label="Refresh Discovery list"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>}
    />
    {error ? <p className="mt-4 rounded-lg bg-[var(--danger-bg)] p-3 text-xs text-[var(--danger-text)]">{error}</p>
      : loading && !sessions ? <p className="mt-4 text-xs text-[var(--muted)]">Loading…</p>
      : rows.length === 0 ? <Empty title="No Discovery activity yet" description="A project's Discovery progress appears here once a customer starts one." />
      : <div className="mt-4 divide-y divide-[var(--border)]">
        {rows.map(session => <Link
          key={session.id}
          href={session.customerId ? `/master/customer?organizationId=${encodeURIComponent(organizationId)}&customerId=${encodeURIComponent(session.customerId)}` : `/projects/view?id=${encodeURIComponent(session.id)}`}
          className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-[var(--surface-2)]"
        >
          <div className="min-w-0">
            <b className="block truncate text-xs">{session.projectName}</b>
            <span className="text-[10px] text-[var(--muted)]">{session.percentComplete}% complete · {session.submittedAt ? `Submitted ${dateTime(session.submittedAt)}` : `Last activity ${dateTime(session.lastActivityAt)}`}</span>
          </div>
          <Status value={session.status} />
        </Link>)}
      </div>}
  </Card>;
}
