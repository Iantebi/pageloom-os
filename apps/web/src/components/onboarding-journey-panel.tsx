"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, Handshake, ListChecks } from "lucide-react";
import { missingRequiredQuestionnaireFields, type Handover, type LaunchChecklistItem, type Project, type RevisionRequest } from "@pageloom/core";
import { api } from "@/lib/api";
import { useLiveCollection } from "@/lib/live-data";
import { Button, Card, Empty, Status, dateTime } from "./product-ui";
import { t } from "@/lib/i18n";

type QuestionnaireLike = { id: string; status: string; fields: { id: string; label: string; type: "short_text" | "long_text" | "email" | "phone" | "url" | "select" | "multi_select" | "boolean" | "file"; required: boolean }[]; responses: Record<string, string | boolean | string[]>; filePaths: string[] };

// Owner Control for one project's onboarding journey (mission section 10): missing materials,
// open revision requests, launch readiness, and handover — everything an Owner needs without
// chasing WhatsApp threads. Lives as a tab on the existing per-project staff view
// (apps/web/src/app/(product)/projects/view/page.tsx).
export function OnboardingJourneyPanel({ organizationId, project, questionnaires }: { organizationId: string; project: Project; questionnaires: QuestionnaireLike[] }) {
  const s = t("onboardingJourneyPanel");
  const brief = questionnaires[0];
  const missing = brief && brief.status !== "completed" ? missingRequiredQuestionnaireFields(brief.fields, brief.responses, brief.filePaths) : [];
  const revisions = useLiveCollection<RevisionRequest>(`organizations/${organizationId}/projects/${project.id}/revisionRequests`, "createdAt", 100);
  const openRevisions = revisions.data.filter(item => item.status === "open");

  return <div className="grid gap-4">
    <Card>
      <h3 className="flex items-center gap-2 text-sm font-semibold"><ClipboardList className="h-4 w-4" />{s.materialsTitle}</h3>
      {missing.length === 0 ? <p className="mt-3 text-xs text-[var(--success-text)]">{s.noMissingMaterials}</p> : <ul className="mt-3 list-inside list-disc text-xs text-[var(--warn-text)]"><li className="font-semibold list-none">{s.missingMaterialsLabel}:</li>{missing.map(fieldId => <li key={fieldId}>{brief?.fields.find(field => field.id === fieldId)?.label ?? fieldId}</li>)}</ul>}
    </Card>
    <Card>
      <h3 className="text-sm font-semibold">{s.revisionsTitle}</h3>
      {openRevisions.length === 0 ? <p className="mt-3 text-xs text-[var(--muted)]">{s.noOpenRevisions}</p> : <div className="mt-3 space-y-3">{openRevisions.map(item => <RevisionRow key={item.id} organizationId={organizationId} projectId={project.id} item={item} />)}</div>}
    </Card>
    <LaunchChecklistCard organizationId={organizationId} projectId={project.id} />
    <HandoverCard organizationId={organizationId} project={project} />
  </div>;
}

function RevisionRow({ organizationId, projectId, item }: { organizationId: string; projectId: string; item: RevisionRequest }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const s = t("onboardingJourneyPanel");
  async function resolve() {
    if (!note.trim()) return;
    setBusy(true);
    try { await api(`/projects/${projectId}/revision-requests/${item.id}/resolve`, { method: "PATCH", body: JSON.stringify({ organizationId, resolutionNote: note.trim() }) }); }
    finally { setBusy(false); }
  }
  return <div className="rounded-xl border border-[var(--border)] p-3">
    <div className="flex items-start justify-between gap-3"><div>{item.area && <b className="text-[10px] text-[var(--muted)]">{item.area}</b>}<p className="mt-1 text-xs">{item.description}</p></div><small className="text-[9px] text-[var(--muted)]">{dateTime(item.createdAt)}</small></div>
    <div className="mt-3 flex gap-2"><input className="input" value={note} onChange={event => setNote(event.target.value)} placeholder={s.resolutionPlaceholder} /><Button variant="secondary" disabled={busy || !note.trim()} onClick={() => void resolve()}>{s.resolveRevision}</Button></div>
  </div>;
}

function LaunchChecklistCard({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const [items, setItems] = useState<LaunchChecklistItem[]>();
  const s = t("onboardingJourneyPanel");
  useEffect(() => { let active = true; void api<{ items: LaunchChecklistItem[] }>(`/projects/${projectId}/launch-checklist?organizationId=${organizationId}`).then(result => { if (active) setItems(result.items); }); return () => { active = false; }; }, [organizationId, projectId]);
  async function toggle(itemId: string, complete: boolean) {
    setItems(current => current?.map(item => item.id === itemId ? { ...item, complete } : item));
    await api(`/projects/${projectId}/launch-checklist/${itemId}`, { method: "PATCH", body: JSON.stringify({ organizationId, complete }) });
  }
  if (!items) return <Card aria-busy="true"><Empty title={s.launchChecklistTitle} description="…" /></Card>;
  const ready = items.filter(item => item.required).every(item => item.complete);
  return <Card>
    <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="h-4 w-4" />{s.launchChecklistTitle}</h3><Status value={ready ? "completed" : "active"} label={ready ? s.launchReadyYes : s.launchReadyNo} /></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{items.map(item => <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2 text-xs" key={item.id}><input type="checkbox" checked={item.complete} onChange={event => void toggle(item.id, event.target.checked)} />{item.label}{item.required && " *"}</label>)}</div>
  </Card>;
}

function HandoverCard({ organizationId, project }: { organizationId: string; project: Project }) {
  const [handover, setHandover] = useState<Handover | null>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const s = t("onboardingJourneyPanel");
  useEffect(() => { let active = true; void api<Handover | null>(`/projects/${project.id}/handover?organizationId=${organizationId}`).then(result => { if (active) setHandover(result); }); return () => { active = false; }; }, [organizationId, project.id]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<Handover>(`/projects/${project.id}/handover`, { method: "POST", body: JSON.stringify({ organizationId, liveUrl: form.get("liveUrl"), supportInstructions: form.get("supportInstructions"), maintenanceInfo: form.get("maintenanceInfo"), pageloomResponsibilities: form.get("pageloomResponsibilities"), customerResponsibilities: form.get("customerResponsibilities") }) });
      setHandover(result); setMessage(s.saved);
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : s.submitError); }
    finally { setBusy(false); }
  }
  if (handover === undefined) return null;
  if (handover) return <Card><h3 className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4" />{s.handoverTitle}</h3><p className="mt-2 text-xs text-[var(--success-text)]">{s.alreadyHandedOver}: {handover.liveUrl}</p></Card>;
  return <Card>
    <h3 className="flex items-center gap-2 text-sm font-semibold"><Handshake className="h-4 w-4" />{s.handoverTitle}</h3>
    <form onSubmit={submit} className="mt-3 space-y-3">
      <label className="field"><span>{s.handoverLiveUrl}</span><input required type="url" name="liveUrl" className="input" /></label>
      <label className="field"><span>{s.handoverSupportInstructions}</span><textarea required name="supportInstructions" className="input min-h-20" /></label>
      <label className="field"><span>{s.handoverMaintenanceInfo}</span><textarea required name="maintenanceInfo" className="input min-h-20" /></label>
      <label className="field"><span>{s.handoverPageloomResponsibilities}</span><textarea required name="pageloomResponsibilities" className="input min-h-20" /></label>
      <label className="field"><span>{s.handoverCustomerResponsibilities}</span><textarea required name="customerResponsibilities" className="input min-h-20" /></label>
      <Button disabled={busy} type="submit">{busy ? s.submitting : s.recordHandover}</Button>
    </form>
    {message && <p className="mt-3 text-xs text-[var(--muted)]" role="status">{message}</p>}
  </Card>;
}
