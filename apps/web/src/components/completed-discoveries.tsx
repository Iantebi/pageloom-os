"use client";
import Link from "next/link";
import { ExternalLink, FileCheck2, Rocket } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useOrganization } from "@/lib/organization";
import { Button, Card, CardHeader, Empty, Status, dateTime } from "@/components/product-ui";
import { t } from "@/lib/i18n";

// Owner Dashboard "Completed Discoveries" section (2026-09-28) — the Owner should never have to
// search /discoveries manually for a submitted client. Reuses the same staff-only
// GET /discovery/management/sessions endpoint discovery-management-list.tsx and /discoveries
// already call; this component only adds its own filter (submitted/reviewed), sort (most recently
// submitted first, capped at 5), and the two-action card layout /discoveries's table has no room
// for. Both card actions stay inside Owner Workspace (/projects/view's onboarding/website tabs) —
// see discovery-management-list.tsx's own 2026-09-28 comment for the /master-linking bug this
// was written alongside fixing.
type CompletedSession = {
  id: string; businessName: string; ownerName: string | null; status: string;
  submittedAt: string | null; journeyStage: string | null;
};

const completedStatuses = new Set(["submitted", "reviewed"]);

export function CompletedDiscoveries() {
  const s = t("completedDiscoveries");
  const c = t("common");
  const statusLabels = t("statusLabels") as Record<string, string>;
  const { organizationId } = useOrganization();
  const [sessions, setSessions] = useState<CompletedSession[]>();
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!organizationId) return undefined;
    return api<CompletedSession[]>(`/discovery/management/sessions?organizationId=${encodeURIComponent(organizationId)}`)
      .then(result => { setError(""); setSessions(result); })
      .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : s.loadErrorFallback));
  }, [organizationId, s.loadErrorFallback]);

  useEffect(() => { void load(); }, [load]);

  const completed = (sessions ?? [])
    .filter(session => completedStatuses.has(session.status))
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""))
    .slice(0, 5);

  return <Card>
    <CardHeader
      icon={FileCheck2} title={s.title} subtitle={s.subtitle}
      action={<Link href="/discoveries" className="text-[10px] font-semibold text-[var(--accent-on-soft)]">{s.viewAll}</Link>}
    />
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {sessions === undefined && !error && <p className="text-xs text-[var(--muted)]">{c.loading}</p>}
    {sessions !== undefined && completed.length === 0 && <Empty title={s.emptyTitle} description={s.emptyDescription} />}
    {completed.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {completed.map(session => {
        const stage = session.journeyStage;
        return <div key={session.id} className="rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-start justify-between gap-2">
            <b className="text-[11px]">{session.businessName}</b>
            <Status value={session.status} />
          </div>
          <p className="mt-1 text-[10px] text-[var(--muted)]">{s.contactLabel}: {session.ownerName ?? s.noContactName}</p>
          <div className="mt-3 space-y-1 text-[9px] text-[var(--muted)]">
            <div>{s.submittedLabel}: {session.submittedAt ? dateTime(session.submittedAt) : "—"}</div>
            <div>{s.stageLabel}: {statusLabels[stage ?? ""] ?? (stage ? stage.replaceAll("_", " ") : "—")}</div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/projects/view?id=${encodeURIComponent(session.id)}&tab=onboarding`} className="flex-1">
              <Button className="w-full justify-center"><ExternalLink className="h-3.5 w-3.5" />{s.openDiscovery}</Button>
            </Link>
            <Link href={`/projects/view?id=${encodeURIComponent(session.id)}&tab=website`} className="flex-1">
              <Button variant="secondary" className="w-full justify-center"><Rocket className="h-3.5 w-3.5" />{s.startBuilding}</Button>
            </Link>
          </div>
        </div>;
      })}
    </div>}
  </Card>;
}
