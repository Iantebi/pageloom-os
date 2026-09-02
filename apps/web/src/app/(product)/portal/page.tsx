"use client";

import { useEffect, useState } from "react";
import { ref, uploadBytes } from "firebase/storage";
import { CheckCircle2, Eye, FileText, Headphones, LoaderCircle, RotateCcw, Send, UploadCloud } from "lucide-react";
import { missingRequiredQuestionnaireFields, type Handover, type Project } from "@pageloom/core";
import { firebaseAuth, firebaseStorage } from "@/lib/firebase";
import { api } from "@/lib/api";
import { useOrganization } from "@/lib/organization";
import { useLiveCollection } from "@/lib/live-data";
import { Button, Card, Empty, PageHeader, Status } from "@/components/product-ui";
import { WebsiteContentWorkspace } from "@/components/website-content-workspace";
import { WebsiteContentReviewPanel } from "@/components/website-content-preview";
import { WelcomePanel } from "@/components/welcome-panel";
import { CustomerJourneyTimeline } from "@/components/customer-journey-timeline";
import { DiscoveryTaskCard } from "@/components/discovery-task-card";
import { t, dateTime } from "@/lib/i18n";

type QuestionnaireField = { id: string; label: string; type: "short_text" | "long_text" | "email" | "phone" | "url" | "select" | "multi_select" | "boolean" | "file"; required: boolean; options?: string[]; helpText?: string };
type Questionnaire = { id: string; title: string; version: number; status: string; fields: QuestionnaireField[]; responses?: Record<string, string | boolean | string[]>; filePaths?: string[]; createdAt: string; completedAt?: string };
type SupportTicket = { id: string; projectId: string; subject: string; description: string; priority: string; status: string; responseDueAt: string; resolution?: string; updatedAt: string };

export default function Portal() {
  const { organizationId, membership } = useOrganization();
  const client = membership?.role === "client";
  const projects = useLiveCollection<Project>(organizationId ? `organizations/${organizationId}/projects` : undefined, "updatedAt", 100, client ? "customerId" : undefined, client ? membership.customerId : undefined);
  const tickets = useLiveCollection<SupportTicket>(organizationId ? `organizations/${organizationId}/supportTickets` : undefined, "updatedAt", 100, client ? "customerId" : undefined, client ? membership.customerId : undefined);
  const [id, setId] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const project = projects.data.find(item => item.id === id) ?? projects.data[0];
  const questionnaires = useLiveCollection<Questionnaire>(organizationId && project ? `organizations/${organizationId}/projects/${project.id}/questionnaires` : undefined, "version", 20);
  const websiteUrl = project ? String((project as unknown as Record<string, unknown>).websiteUrl ?? "") : "";
  const s = t("portal");

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const uid = firebaseAuth.currentUser?.uid;
    if (!file || !uid || !project) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await uploadBytes(ref(firebaseStorage, `organizations/${organizationId}/uploads/${uid}/${project.id}/${crypto.randomUUID()}-${file.name}`), file, { contentType: file.type, customMetadata: { projectId: project.id, purpose: "customer-review" } });
      setMessage(s.uploadSuccess);
    } catch {
      setError(s.uploadError);
    } finally { setBusy(false); event.target.value = ""; }
  }

  async function send() {
    if (!project || !comment.trim()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/projects/${project.id}/comments`, { method: "POST", body: JSON.stringify({ organizationId, content: comment.trim() }) });
      setComment(""); setMessage(s.commentSent);
    } catch { setError(s.commentError); }
    finally { setBusy(false); }
  }

  async function review(type: "CustomerApproved" | "CustomerRequestedRevision") {
    if (!project) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api("/workflow/events", { method: "POST", body: JSON.stringify({ organizationId, projectId: project.id, type, payload: { comment: comment.trim() || null } }) });
      setComment("");
      setMessage(type === "CustomerApproved" ? s.approvedMessage : s.revisionRequestedMessage);
    } catch { setError(s.reviewError); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <PageHeader eyebrow={s.eyebrow} title={s.title} description={s.description} />
    <Card><div className="grid gap-3 md:grid-cols-4">{s.steps.map((step,index)=><div className="rounded-xl bg-[var(--surface-2)] p-4" key={step}><b className="text-xs">{step}</b><p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">{index<2?s.stepActionNeeded:s.stepAutoUpdates}</p></div>)}</div></Card>
    {projects.error && <Card role="alert"><p className="text-xs text-[var(--danger-text)]">{s.projectsError}</p></Card>}
    {projects.loading && !projects.data.length ? <Card aria-busy="true"><div className="flex min-h-40 items-center justify-center gap-2 text-xs text-[var(--muted)]"><LoaderCircle className="h-4 w-4 animate-spin" />{s.loadingProject}</div></Card> : project ? <>
      {projects.data.length > 1 && <Card><label className="field"><span>{s.selectProjectLabel}</span><select className="input" value={project.id} onChange={event => setId(event.target.value)}>{projects.data.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></Card>}
      <div className="grid gap-4 lg:grid-cols-2">
        <WelcomePanel project={project} />
        <div className="lg:col-span-2"><CustomerJourneyTimeline project={project} /></div>
        <DiscoveryTaskCard organizationId={organizationId} projectId={project.id} />
        <Card aria-label={s.progressTitle}><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">{s.progressTitle}</h2><p className="mt-1 text-xs text-[var(--muted)]">{s.currentStageLabel(project.workflowStage ?? project.journeyStage)}</p></div><Status value={project.workflowStatus ?? project.status} /></div><b className="mt-5 block text-3xl" aria-label={s.progressPercentAria(project.progress)}>{project.progress}%</b><div className="progress mt-4" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={project.progress}><i style={{ width: `${project.progress}%` }} /></div>{project.blockedReason && <p className="mt-4 rounded-lg bg-[var(--warn-bg)] p-3 text-xs text-[var(--warn-text)]">{s.blockedNotice}</p>}</Card>
        <Card><h2 className="text-sm font-semibold">{s.materialsTitle}</h2><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{s.materialsDescription}</p><label className="button button-secondary mt-5 cursor-pointer justify-center"><UploadCloud className="h-4 w-4" />{busy ? s.uploading : s.chooseFile}<input className="sr-only" type="file" disabled={busy} onChange={upload} /></label></Card>
        <div id="website-brief" className="contents">{(project.workflowStage === "questionnaire" || questionnaires.data.length > 0) && <CustomerQuestionnaire organizationId={organizationId} projectId={project.id} questionnaires={questionnaires} />}</div>
        {websiteUrl && <Card className="lg:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">{s.previewTitle}</h2><p className="mt-1 text-xs text-[var(--muted)]">{s.previewDescription}</p></div><a className="button button-secondary" href={websiteUrl} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" />{s.openSite}</a></div></Card>}
        <HandoverPanel organizationId={organizationId} project={project} />
        <WebsiteContentWorkspace organizationId={organizationId} projectId={project.id} customerMode={client} />
        <WebsiteContentReviewPanel organizationId={organizationId} projectId={project.id} customerMode />
        <Card className="lg:col-span-2"><h2 className="text-sm font-semibold">{s.commentsTitle}</h2><label className="field mt-4"><span>{s.commentLabel}</span><textarea className="input min-h-28" value={comment} onChange={event => setComment(event.target.value)} placeholder={s.commentPlaceholder} maxLength={4000} /></label><div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" disabled={!comment.trim() || busy} onClick={() => void send()}><Send className="h-4 w-4" />{s.sendComment}</Button>{project.workflowStage === "customer_review" && <><Button variant="secondary" disabled={busy} onClick={() => void review("CustomerRequestedRevision")}><RotateCcw className="h-4 w-4" />{s.requestChanges}</Button><Button disabled={busy} onClick={() => void review("CustomerApproved")}><CheckCircle2 className="h-4 w-4" />{s.approveSite}</Button></>}</div>{message && <p className="mt-4 rounded-lg bg-[var(--success-bg)] p-3 text-xs text-[var(--success-text)]" role="status">{message}</p>}{error && <p className="mt-4 rounded-lg bg-[var(--danger-bg)] p-3 text-xs text-[var(--danger-text)]" role="alert">{error}</p>}</Card>
        {project.workflowStage === "customer_review" && <RevisionRequestPanel organizationId={organizationId} projectId={project.id} />}
        <CustomerSupport organizationId={organizationId} projectId={project.id} tickets={tickets.data.filter(ticket => ticket.projectId === project.id)} />
      </div>
    </> : <Card><Empty title={s.noProjectTitle} description={s.noProjectDescription} /></Card>}
  </div>;
}

function CustomerSupport({ organizationId, projectId, tickets }: { organizationId: string; projectId: string; tickets: SupportTicket[] }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const s = t("portalSupport"), c = t("common");
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setMessage(""); const form = new FormData(event.currentTarget); try { const result = await api<{ id: string; responseDueAt: string }>(`/projects/${projectId}/support-tickets`, { method: "POST", body: JSON.stringify({ organizationId, subject: form.get("subject"), description: form.get("description"), priority: form.get("priority") }) }); setMessage(s.ticketReceived(dateTime(result.responseDueAt))); setOpen(false); } catch (error) { setMessage(error instanceof Error ? error.message : s.ticketError); } finally { setBusy(false); } }
  return <Card className="lg:col-span-2"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><Headphones className="h-4 w-4" />{s.title}</h2><p className="mt-1 text-xs text-[var(--muted)]">{s.description}</p></div><Button variant="secondary" onClick={() => setOpen(true)}>{s.openTicket}</Button></div>{tickets.length ? <div className="mt-4 space-y-2">{tickets.map(ticket => <div className="rounded-xl border border-[var(--border)] p-3" key={ticket.id}><div className="flex items-start justify-between gap-3"><div><b className="text-[10px]">{ticket.subject}</b><small className="mt-1 block text-[9px] text-[var(--muted)]">{s.responseDueLabel(dateTime(ticket.responseDueAt))}</small></div><Status value={ticket.status} /></div>{ticket.resolution && <p className="mt-2 rounded-lg bg-[var(--success-bg)] p-2 text-[10px] text-[var(--success-text)]">{ticket.resolution}</p>}</div>)}</div> : <p className="mt-4 text-xs text-[var(--muted)]">{s.noTickets}</p>}{message && <p className="mt-4 rounded-lg bg-[var(--accent-soft)] p-3 text-xs text-[var(--accent-on-soft)]" role="status">{message}</p>}{open && <div className="modal-backdrop"><form className="modal text-start" onSubmit={submit}><h2 className="text-lg font-semibold">{s.modalTitle}</h2><label className="field mt-4"><span>{s.subjectLabel}</span><input className="input" name="subject" minLength={3} required /></label><label className="field mt-4"><span>{s.descriptionLabel}</span><textarea className="input min-h-28" name="description" minLength={10} required /></label><label className="field mt-4"><span>{s.priorityLabel}</span><select className="input" name="priority" defaultValue="normal"><option value="critical">{s.priorityCritical}</option><option value="high">{s.priorityHigh}</option><option value="normal">{s.priorityNormal}</option><option value="low">{s.priorityLow}</option></select></label><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>{c.cancel}</Button><Button disabled={busy} type="submit">{busy ? s.sending : s.submitTicket}</Button></div></form></div>}</Card>;
}

function CustomerQuestionnaire({ organizationId, projectId, questionnaires }: { organizationId: string; projectId: string; questionnaires: ReturnType<typeof useLiveCollection<Questionnaire>> }) {
  const questionnaire = questionnaires.data[0];
  const s = t("portalQuestionnaire");
  if (questionnaires.loading && !questionnaire) return <Card className="lg:col-span-2" aria-busy="true"><div className="flex items-center justify-center gap-2 py-10 text-xs text-[var(--muted)]"><LoaderCircle className="h-4 w-4 animate-spin" />{s.loading}</div></Card>;
  if (questionnaires.error) return <Card className="lg:col-span-2" role="alert"><p className="text-xs text-[var(--danger-text)]">{s.error}</p></Card>;
  if (!questionnaire) return <Card className="lg:col-span-2"><Empty title={s.pendingTitle} description={s.pendingDescription} /></Card>;
  return <QuestionnaireForm key={questionnaire.id} organizationId={organizationId} projectId={projectId} questionnaire={questionnaire} />;
}

function QuestionnaireForm({ organizationId, projectId, questionnaire }: { organizationId: string; projectId: string; questionnaire: Questionnaire }) {
  const [responses, setResponses] = useState<Record<string, string | boolean | string[]>>(questionnaire.responses ?? {});
  const [paths, setPaths] = useState<string[]>(questionnaire.filePaths ?? []);
  const [uploading, setUploading] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const completed = questionnaire.status === "completed";
  const s = t("portalQuestionnaire");

  async function upload(field: QuestionnaireField, file?: File) {
    const uid = firebaseAuth.currentUser?.uid;
    if (!file || !uid || completed) return;
    setUploading(field.id); setError(""); setMessage("");
    try {
      const path = `organizations/${organizationId}/questionnaires/${projectId}/${questionnaire.id}/${field.id}/${uid}/${crypto.randomUUID()}-${file.name}`;
      await uploadBytes(ref(firebaseStorage, path), file, { contentType: file.type, customMetadata: { projectId, questionnaireId: questionnaire.id, fieldId: field.id } });
      setPaths(current => [...current.filter(item => !item.includes(`/${field.id}/`)), path]);
      setMessage(s.fileUploadSuccess(field.label));
    } catch { setError(s.fileUploadError(field.label)); }
    finally { setUploading(undefined); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      await api(`/projects/${projectId}/questionnaires/${questionnaire.id}/complete`, { method: "POST", body: JSON.stringify({ organizationId, responses, filePaths: paths }) });
      setMessage(s.submitSuccess);
    } catch (failure) { setError(failure instanceof Error ? failure.message : s.submitError); }
    finally { setSaving(false); }
  }

  const missing = completed ? [] : missingRequiredQuestionnaireFields(questionnaire.fields, responses, paths);
  return <Card className="lg:col-span-2"><form onSubmit={submit}><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="eyebrow">{s.versionEyebrow(questionnaire.version)}</span><h2 className="mt-2 flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5" />{questionnaire.title}</h2><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{s.intro}</p></div><Status value={questionnaire.status} /></div>{missing.length > 0 && <div className="mt-4 rounded-lg bg-[var(--warn-bg)] p-3 text-xs text-[var(--warn-text)]"><b>{s.missingFieldsTitle(missing.length)}</b><ul className="mt-1 list-inside list-disc">{missing.map(fieldId => <li key={fieldId}>{questionnaire.fields.find(field => field.id === fieldId)?.label ?? fieldId}</li>)}</ul></div>}<fieldset disabled={completed || saving} className="mt-6 space-y-5 disabled:opacity-70">{questionnaire.fields.map(field => <label className="field" key={field.id}><span>{field.label}{field.required && " *"}</span>{field.helpText && <small className="text-[10px] leading-4 text-[var(--muted)]">{field.helpText}</small>}<QuestionnaireInput field={field} value={responses[field.id]} fileReady={paths.some(path => path.includes(`/${field.id}/`))} uploading={uploading === field.id} setValue={value => setResponses(current => ({ ...current, [field.id]: value }))} upload={file => void upload(field, file)} /></label>)}</fieldset>{!completed && <Button className="mt-6" disabled={saving || Boolean(uploading)} type="submit">{saving ? s.submitting : s.submit}</Button>}{completed && <p className="mt-6 flex items-center gap-2 rounded-lg bg-[var(--success-bg)] p-3 text-xs text-[var(--success-text)]"><CheckCircle2 className="h-4 w-4" />{s.completed}</p>}{message && <p className="mt-4 rounded-lg bg-[var(--success-bg)] p-3 text-xs text-[var(--success-text)]" role="status">{message}</p>}{error && <p className="mt-4 rounded-lg bg-[var(--danger-bg)] p-3 text-xs text-[var(--danger-text)]" role="alert">{error}</p>}</form></Card>;
}

function RevisionRequestPanel({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const s = t("portal");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!description.trim()) return;
    setBusy(true); setMessage("");
    try {
      await api(`/projects/${projectId}/revision-requests`, { method: "POST", body: JSON.stringify({ organizationId, description: description.trim(), area: area.trim() || undefined }) });
      setDescription(""); setArea(""); setMessage(s.revisionRequestSent);
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : s.revisionRequestError); }
    finally { setBusy(false); }
  }
  return <Card className="lg:col-span-2"><h2 className="text-sm font-semibold">{s.revisionRequestTitle}</h2><p className="mt-1 text-xs text-[var(--muted)]">{s.revisionRequestDescription}</p><form onSubmit={submit} className="mt-4 space-y-3"><label className="field"><span>{s.revisionAreaLabel}</span><input className="input" value={area} onChange={event => setArea(event.target.value)} placeholder={s.revisionAreaPlaceholder} maxLength={120} /></label><label className="field"><span>{s.revisionDescriptionLabel}</span><textarea required className="input min-h-24" value={description} onChange={event => setDescription(event.target.value)} maxLength={5000} /></label><Button disabled={busy || !description.trim()} type="submit">{busy ? s.sending : s.sendRevisionRequest}</Button></form>{message && <p className="mt-3 text-xs text-[var(--muted)]" role="status">{message}</p>}</Card>;
}

function HandoverPanel({ organizationId, project }: { organizationId: string; project: Project }) {
  const [handover, setHandover] = useState<Handover | null>(null);
  const live = project.workflowStage === "completed";
  const s = t("portal");
  useEffect(() => {
    if (!live) return;
    let active = true;
    void api<Handover | null>(`/projects/${project.id}/handover?organizationId=${organizationId}`).then(result => { if (active) setHandover(result); }).catch(() => { if (active) setHandover(null); });
    return () => { active = false; };
  }, [organizationId, project.id, live]);
  if (!live || !handover) return null;
  return <Card className="lg:col-span-2"><h2 className="text-sm font-semibold">{s.handoverTitle}</h2><div className="mt-3 grid gap-3 sm:grid-cols-2"><a className="button button-secondary" href={handover.liveUrl} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" />{s.openSite}</a></div><div className="mt-4 space-y-3 text-xs leading-5 text-[var(--muted)]"><p><b className="text-[var(--text)]">{s.handoverSupport}</b> {handover.supportInstructions}</p><p><b className="text-[var(--text)]">{s.handoverMaintenance}</b> {handover.maintenanceInfo}</p><p><b className="text-[var(--text)]">{s.handoverPageloom}</b> {handover.pageloomResponsibilities}</p><p><b className="text-[var(--text)]">{s.handoverCustomer}</b> {handover.customerResponsibilities}</p></div></Card>;
}

function QuestionnaireInput({ field, value, fileReady, uploading, setValue, upload }: { field: QuestionnaireField; value: string | boolean | string[] | undefined; fileReady: boolean; uploading: boolean; setValue: (value: string | boolean | string[]) => void; upload: (file?: File) => void }) {
  const s = t("portalQuestionnaire");
  if (field.type === "long_text") return <textarea required={field.required} className="input min-h-28" value={String(value ?? "")} onChange={event => setValue(event.target.value)} />;
  if (field.type === "boolean") return <span className="flex items-center gap-2 text-xs"><input required={field.required} type="checkbox" checked={Boolean(value)} onChange={event => setValue(event.target.checked)} />{s.yes}</span>;
  if (field.type === "file") return <><input required={field.required && !fileReady} type="file" className="input" onChange={event => upload(event.target.files?.[0])} />{uploading && <small className="flex items-center gap-1 text-[10px] text-[var(--muted)]"><LoaderCircle className="h-3 w-3 animate-spin" />{s.uploadingFile}</small>}{fileReady && !uploading && <small className="text-[10px] text-[var(--success-text)]">{s.fileSaved}</small>}</>;
  if (field.type === "select") return <select required={field.required} className="input" value={String(value ?? "")} onChange={event => setValue(event.target.value)}><option value="">{s.selectPlaceholder}</option>{field.options?.map(option => <option value={option} key={option}>{option}</option>)}</select>;
  if (field.type === "multi_select") { const selected = Array.isArray(value) ? value : []; return <div className="grid gap-2 sm:grid-cols-2">{field.options?.map(option => <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-3 text-xs" key={option}><input type="checkbox" checked={selected.includes(option)} onChange={event => setValue(event.target.checked ? [...selected, option] : selected.filter(item => item !== option))} />{option}</label>)}</div>; }
  return <input required={field.required} type={field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "phone" ? "tel" : "text"} className="input" value={String(value ?? "")} onChange={event => setValue(event.target.value)} />;
}
