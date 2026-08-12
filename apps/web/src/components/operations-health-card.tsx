"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import type { HealthReport } from "@pageloom/core";
import { api } from "@/lib/api";
import { useLiveCollection } from "@/lib/live-data";
import { useOrganization } from "@/lib/organization";
import { Button, Card, CardHeader, Empty, Status, dateTime } from "./product-ui";

type DeadLetter = { id: string; agentId: string; reason: string; status: string; createdAt: string };

export function OperationsHealthCard() {
  const pathname = usePathname();
  const { organizationId, membership } = useOrganization();
  const visible = pathname === "/dashboard" && membership?.role !== "client";
  const [health, setHealth] = useState<HealthReport>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const deadLetters = useLiveCollection<DeadLetter>(
    visible && organizationId ? `organizations/${organizationId}/deadLetters` : undefined,
    "createdAt",
  );

  const load = useCallback(() => {
    if (!visible || !organizationId) return;
    api<HealthReport>(`/operations/${organizationId}/health`)
      .then((value) => { setHealth(value); setError(""); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Health check failed"));
  }, [organizationId, visible]);

  useEffect(() => {
    if (!visible) return;
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load, visible]);

  async function retry(id: string) {
    setBusy(id);
    try {
      await api(`/operations/${organizationId}/dead-letters/${id}/retry`, { method: "POST" });
      load();
    } finally { setBusy(""); }
  }

  if (!visible) return null;
  const open = deadLetters.data.filter((item) => item.status === "open");
  return <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]" aria-label="Operational health">
    <Card>
      <CardHeader icon={health?.status === "healthy" ? CheckCircle2 : ShieldAlert} title="Operational health" subtitle="Live reliability signals across delivery and AI operations" action={health && <Status value={health.status} />} />
      {health ? <>
        <div className="mt-3 flex items-end gap-3"><b className="text-4xl">{health.score}</b><span className="pb-1 text-[9px] text-[var(--muted)]">/ 100 reliability score</span></div>
        <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3">{Object.entries(health.signals).map(([label, value]) => <div className={`rounded-xl p-3 ${value ? "bg-[#fff4e5]" : "bg-[#f5f6f2]"}`} key={label}><b className="block text-lg">{value}</b><span className="text-[8px] capitalize text-[var(--muted)]">{label.replaceAll(/([A-Z])/g, " $1")}</span></div>)}</div>
      </> : <Empty title="Health unavailable" description={error || "Waiting for the first operational health check."} />}
    </Card>
    <Card>
      <CardHeader icon={AlertTriangle} title="Recovery queue" subtitle="Exhausted tasks requiring owner review" action={<span className="text-[9px] font-bold">{open.length} open</span>} />
      {open.slice(0, 5).map((item) => <div className="mb-2 rounded-xl border border-[var(--border)] p-3" key={item.id}><div className="flex items-start justify-between gap-3"><div><b className="text-[10px]">{item.agentId}</b><p className="mt-1 text-[9px] leading-4 text-[var(--muted)]">{item.reason}</p><small className="mt-2 block text-[8px] text-[var(--muted)]">{dateTime(item.createdAt)}</small></div>{membership?.role === "owner" && <Button variant="secondary" disabled={busy === item.id} onClick={() => void retry(item.id)}><RefreshCw className="h-3.5 w-3.5" />{busy === item.id ? "Retrying" : "Retry"}</Button>}</div></div>)}
      {!open.length && <Empty title="No dead letters" description="Automatic recovery has no exhausted tasks requiring intervention." />}
    </Card>
  </section>;
}
