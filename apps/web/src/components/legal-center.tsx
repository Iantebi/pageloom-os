"use client";

import { useEffect, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { api } from "@/lib/api";
import { useOrganization } from "@/lib/organization";
import { Card, CardHeader, Empty, Status } from "./product-ui";

type LegalDocument = { id: string; title: string; version: string; content: string; contentHash: string; effectiveAt: string; status: string };

export function LegalCenter() {
  const { organizationId } = useOrganization();
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loadedOrganization, setLoadedOrganization] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!organizationId) return;
    api<LegalDocument[]>(`/legal/documents?organizationId=${encodeURIComponent(organizationId)}`)
      .then(items => { setDocuments(items); setError(""); setLoadedOrganization(organizationId); })
      .catch(() => setError("לא הצלחנו לטעון את המסמכים המשפטיים. נסו לרענן את העמוד."))
  }, [organizationId]);
  const loading = loadedOrganization !== organizationId && !error;

  return <Card className="lg:col-span-2" dir="rtl" lang="he" aria-busy={loading}>
    <CardHeader icon={FileCheck2} title="מרכז המסמכים המשפטיים" subtitle="הסכמים, פרטיות, נגישות ותנאי עיבוד מידע לפי גרסה מאושרת" />
    {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700" role="alert">{error}</p>}
    {documents.length ? <div className="grid gap-2 md:grid-cols-2">{documents.map(item => <details key={item.id} className="rounded-xl border border-[var(--border)] p-4"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><span><b className="block text-xs">{item.title}</b><small className="mt-1 block text-[10px] text-[var(--muted)]">גרסה {item.version} · בתוקף מ־{new Date(item.effectiveAt).toLocaleDateString("he-IL")}</small></span><Status value={item.status} /></div></summary><div className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap border-t border-[var(--border)] pt-4 text-xs leading-6 text-[var(--muted)]">{item.content}</div><code className="mt-3 block truncate text-left text-[9px] text-[#8d9188]" dir="ltr">SHA-256 {item.contentHash}</code></details>)}</div> : <Empty title={loading ? "טוענים מסמכים משפטיים…" : "עדיין אין מסמכים שפורסמו"} description="בפורטל מוצגות רק גרסאות מאושרות ובלתי ניתנות לשינוי." />}
  </Card>;
}
