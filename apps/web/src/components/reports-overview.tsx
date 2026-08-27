"use client";

import { useCallback, useEffect, useState } from "react";
import { FileBarChart, FileDown } from "lucide-react";
import { api, apiFile } from "@/lib/api";
import { useOrganization } from "@/lib/organization";
import { Button, Card, CardHeader, Empty, dateTime } from "./product-ui";
import { t } from "@/lib/i18n";

type Report = { id: string; type: string; title: string; generatedAt: string; periodStart: string; periodEnd: string };
const types = ["executive", "monthly", "customer", "financial", "infrastructure", "support", "growth"] as const;

export function ReportsOverview() {
  const { organizationId } = useOrganization();
  const [reports, setReports] = useState<Report[]>([]);
  const [type, setType] = useState<(typeof types)[number]>("executive");
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () => api<Report[]>(`/reports?organizationId=${encodeURIComponent(organizationId)}`).then(setReports),
    [organizationId],
  );

  useEffect(() => {
    if (organizationId) void load();
  }, [organizationId, load]);

  async function generate() {
    const end = new Date();
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    setBusy(true);
    try {
      await api("/reports", { method: "POST", body: JSON.stringify({ organizationId, type, periodStart: start.toISOString(), periodEnd: end.toISOString() }) });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function download(report: Report, format: "pdf" | "csv") {
    const blob = await apiFile(`/reports/${report.id}/${format}?organizationId=${encodeURIComponent(organizationId)}`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.type}-${report.id}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const s = t("reportsOverview");
  return <Card>
    <CardHeader icon={FileBarChart} title={s.title} subtitle={s.subtitle} action={<div className="flex gap-2"><select className="input" value={type} onChange={event => setType(event.target.value as typeof type)}>{types.map(item => <option value={item} key={item}>{s.typeLabel(item)}</option>)}</select><Button disabled={busy} onClick={() => void generate()}>{s.generate}</Button></div>} />
    {reports.length ? <div className="divide-y divide-[var(--border)]">{reports.slice(0, 10).map(report => <div className="flex items-center justify-between gap-3 py-3" key={report.id}><span><b className="block text-[11px]">{report.title}</b><small className="text-[9px] text-[var(--muted)]">{dateTime(report.generatedAt)}</small></span><span className="flex gap-2"><Button variant="secondary" onClick={() => void download(report, "pdf")}><FileDown className="h-3.5 w-3.5" />PDF</Button><Button variant="secondary" onClick={() => void download(report, "csv")}><FileDown className="h-3.5 w-3.5" />CSV</Button></span></div>)}</div> : <Empty title={s.noReportsTitle} description={s.noReportsDescription} />}
  </Card>;
}
