"use client";

import { useState } from "react";
import { ref, uploadBytes } from "firebase/storage";
import { CheckCircle2, Eye, FileText, Headphones, LoaderCircle, RotateCcw, Send, UploadCloud } from "lucide-react";
import { type Project } from "@pageloom/core";
import { firebaseAuth, firebaseStorage } from "@/lib/firebase";
import { api } from "@/lib/api";
import { useOrganization } from "@/lib/organization";
import { useLiveCollection } from "@/lib/live-data";
import { Button, Card, Empty, PageHeader, Status } from "@/components/product-ui";
import { WebsiteContentWorkspace } from "@/components/website-content-workspace";

const stages: Record<string, string> = {
  lead: "ליד", questionnaire: "שאלון", assets: "איסוף חומרים", research: "מחקר",
  brand_strategy: "אסטרטגיית מותג", design_system: "מערכת עיצוב", sitemap: "מפת אתר",
  ux_planning: "תכנון חוויית משתמש", ui_generation: "עיצוב", copywriting: "כתיבה",
  seo: "קידום אורגני", development: "פיתוח", qa: "בדיקות איכות",
  customer_review: "בדיקת הלקוח", revision: "שינויים", final_deployment: "פרסום סופי",
  completed: "הושלם",
};

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

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const uid = firebaseAuth.currentUser?.uid;
    if (!file || !uid || !project) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await uploadBytes(ref(firebaseStorage, `organizations/${organizationId}/uploads/${uid}/${project.id}/${crypto.randomUUID()}-${file.name}`), file, { contentType: file.type, customMetadata: { projectId: project.id, purpose: "customer-review" } });
      setMessage("הקובץ הועלה בהצלחה ונשמר באזור המאובטח של הפרויקט.");
    } catch {
      setError("לא הצלחנו להעלות את הקובץ. בדקו את סוג וגודל הקובץ ונסו שוב.");
    } finally { setBusy(false); event.target.value = ""; }
  }

  async function send() {
    if (!project || !comment.trim()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/projects/${project.id}/comments`, { method: "POST", body: JSON.stringify({ organizationId, content: comment.trim() }) });
      setComment(""); setMessage("ההערה נשלחה לצוות הפרויקט.");
    } catch { setError("לא הצלחנו לשלוח את ההערה. התוכן נשאר בשדה כדי שתוכלו לנסות שוב."); }
    finally { setBusy(false); }
  }

  async function review(type: "CustomerApproved" | "CustomerRequestedRevision") {
    if (!project) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api("/workflow/events", { method: "POST", body: JSON.stringify({ organizationId, projectId: project.id, type, payload: { comment: comment.trim() || null } }) });
      setComment("");
      setMessage(type === "CustomerApproved" ? "האישור התקבל. הפרסום הסופי ממתין לאישור מנהל PageLoom." : "בקשת השינויים התקבלה והועברה לצוות הפרויקט.");
    } catch { setError("לא הצלחנו לשמור את ההחלטה. נסו שוב לפני סגירת העמוד."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6" dir="rtl" lang="he">
    <PageHeader eyebrow="האזור האישי שלכם" title="ברוכים הבאים ל-PageLoom" description="מכאן מתחילים: מלאו את שאלון ההיכרות, העלו את חומרי המותג ועקבו אחר כל שלב עד להשקת האתר." />
    <Card><div className="grid gap-3 md:grid-cols-4">{["1. שאלון היכרות","2. העלאת חומרים","3. בנייה ובדיקות","4. אישור והשקה"].map((step,index)=><div className="rounded-xl bg-[#fafaf8] p-4" key={step}><b className="text-xs">{step}</b><p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">{index<2?"הפעולה שלכם נדרשת כדי שנוכל להתקדם.":"צוות PageLoom יעדכן את הסטטוס כאן בזמן אמת."}</p></div>)}</div></Card>
    {projects.error && <Card role="alert"><p className="text-xs text-red-700">לא הצלחנו לטעון את הפרויקטים. רעננו את העמוד; אם הבעיה נמשכת, פנו לתמיכה.</p></Card>}
    {projects.loading && !projects.data.length ? <Card aria-busy="true"><div className="flex min-h-40 items-center justify-center gap-2 text-xs text-[var(--muted)]"><LoaderCircle className="h-4 w-4 animate-spin" />טוענים את הפרויקט שלכם…</div></Card> : project ? <>
      {projects.data.length > 1 && <Card><label className="field"><span>בחירת פרויקט</span><select className="input" value={project.id} onChange={event => setId(event.target.value)}>{projects.data.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></Card>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card aria-label="התקדמות הפרויקט"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">התקדמות הפרויקט</h2><p className="mt-1 text-xs text-[var(--muted)]">השלב הנוכחי: {stages[project.workflowStage ?? project.journeyStage] ?? "בטיפול"}</p></div><Status value={project.workflowStatus ?? project.status} /></div><b className="mt-5 block text-3xl" aria-label={`${project.progress} אחוזים`}>{project.progress}%</b><div className="progress mt-4" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={project.progress}><i style={{ width: `${project.progress}%` }} /></div>{project.blockedReason && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">הפרויקט ממתין לטיפול צוות PageLoom. אין צורך בפעולה מצדכם כרגע.</p>}</Card>
        <Card><h2 className="text-sm font-semibold">חומרים לפרויקט</h2><p className="mt-2 text-xs leading-5 text-[var(--muted)]">העלו לוגו, תמונות, טקסטים ומסמכים שישמשו באתר. יש להעלות רק חומרים שבבעלותכם או שקיבלתם רשות להשתמש בהם.</p><label className="button button-secondary mt-5 cursor-pointer justify-center"><UploadCloud className="h-4 w-4" />{busy ? "מעלים…" : "בחירת קובץ"}<input className="sr-only" type="file" disabled={busy} onChange={upload} /></label></Card>
        {(project.workflowStage === "questionnaire" || questionnaires.data.length > 0) && <CustomerQuestionnaire organizationId={organizationId} projectId={project.id} questionnaires={questionnaires} />}
        {websiteUrl && <Card className="lg:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">תצוגה מקדימה של האתר</h2><p className="mt-1 text-xs text-[var(--muted)]">הקישור נפתח בחלון חדש. חזרו לכאן כדי לשלוח הערות או אישור.</p></div><a className="button button-secondary" href={websiteUrl} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" />פתיחת האתר</a></div></Card>}
        <WebsiteContentWorkspace organizationId={organizationId} projectId={project.id} customerMode={client} />
        <Card className="lg:col-span-2"><h2 className="text-sm font-semibold">הערות ואישור</h2><label className="field mt-4"><span>הערה לצוות</span><textarea className="input min-h-28" value={comment} onChange={event => setComment(event.target.value)} placeholder="רכזו כאן הערות מדויקות לפי עמוד או אזור באתר" maxLength={4000} /></label><div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" disabled={!comment.trim() || busy} onClick={() => void send()}><Send className="h-4 w-4" />שליחת הערה</Button>{project.workflowStage === "customer_review" && <><Button variant="secondary" disabled={busy} onClick={() => void review("CustomerRequestedRevision")}><RotateCcw className="h-4 w-4" />בקשת שינויים</Button><Button disabled={busy} onClick={() => void review("CustomerApproved")}><CheckCircle2 className="h-4 w-4" />אישור האתר</Button></>}</div>{message && <p className="mt-4 rounded-lg bg-green-50 p-3 text-xs text-green-800" role="status">{message}</p>}{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700" role="alert">{error}</p>}</Card>
        <CustomerSupport organizationId={organizationId} projectId={project.id} tickets={tickets.data.filter(ticket => ticket.projectId === project.id)} />
      </div>
    </> : <Card><Empty title="עדיין אין פרויקט להצגה" description="כאשר הפרויקט שלכם יהיה מוכן, הוא יופיע כאן באופן אוטומטי." /></Card>}
  </div>;
}

function CustomerSupport({ organizationId, projectId, tickets }: { organizationId: string; projectId: string; tickets: SupportTicket[] }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setMessage(""); const form = new FormData(event.currentTarget); try { const result = await api<{ id: string; responseDueAt: string }>(`/projects/${projectId}/support-tickets`, { method: "POST", body: JSON.stringify({ organizationId, subject: form.get("subject"), description: form.get("description"), priority: form.get("priority") }) }); setMessage(`הפנייה התקבלה. יעד המענה הראשוני: ${new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(result.responseDueAt))}.`); setOpen(false); } catch (error) { setMessage(error instanceof Error ? error.message : "לא הצלחנו לפתוח את הפנייה. נסו שוב."); } finally { setBusy(false); } }
  return <Card className="lg:col-span-2"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><Headphones className="h-4 w-4" />תמיכה ושירות</h2><p className="mt-1 text-xs text-[var(--muted)]">פתחו פנייה לפרויקט ועקבו אחר הסטטוס ויעד המענה.</p></div><Button variant="secondary" onClick={() => setOpen(true)}>פתיחת פנייה</Button></div>{tickets.length ? <div className="mt-4 space-y-2">{tickets.map(ticket => <div className="rounded-xl border border-[var(--border)] p-3" key={ticket.id}><div className="flex items-start justify-between gap-3"><div><b className="text-[10px]">{ticket.subject}</b><small className="mt-1 block text-[9px] text-[var(--muted)]">יעד מענה: {new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(ticket.responseDueAt))}</small></div><Status value={ticket.status} /></div>{ticket.resolution && <p className="mt-2 rounded-lg bg-green-50 p-2 text-[10px] text-green-800">{ticket.resolution}</p>}</div>)}</div> : <p className="mt-4 text-xs text-[var(--muted)]">אין פניות פתוחות בפרויקט.</p>}{message && <p className="mt-4 rounded-lg bg-[#f4f1ff] p-3 text-xs text-[#58429e]" role="status">{message}</p>}{open && <div className="modal-backdrop"><form className="modal text-start" onSubmit={submit}><h2 className="text-lg font-semibold">פתיחת פנייה לתמיכה</h2><label className="field mt-4"><span>נושא</span><input className="input" name="subject" minLength={3} required /></label><label className="field mt-4"><span>תיאור מלא</span><textarea className="input min-h-28" name="description" minLength={10} required /></label><label className="field mt-4"><span>דחיפות</span><select className="input" name="priority" defaultValue="normal"><option value="critical">קריטי — האתר אינו זמין</option><option value="high">גבוהה — פגיעה משמעותית</option><option value="normal">רגילה</option><option value="low">נמוכה</option></select></label><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>ביטול</Button><Button disabled={busy} type="submit">{busy ? "שולחים…" : "שליחת הפנייה"}</Button></div></form></div>}</Card>;
}

function CustomerQuestionnaire({ organizationId, projectId, questionnaires }: { organizationId: string; projectId: string; questionnaires: ReturnType<typeof useLiveCollection<Questionnaire>> }) {
  const questionnaire = questionnaires.data[0];
  if (questionnaires.loading && !questionnaire) return <Card className="lg:col-span-2" aria-busy="true"><div className="flex items-center justify-center gap-2 py-10 text-xs text-[var(--muted)]"><LoaderCircle className="h-4 w-4 animate-spin" />טוענים את שאלון ההיכרות…</div></Card>;
  if (questionnaires.error) return <Card className="lg:col-span-2" role="alert"><p className="text-xs text-red-700">לא הצלחנו לטעון את שאלון ההיכרות. רעננו את העמוד; התשובות שכבר נשמרו לא יימחקו.</p></Card>;
  if (!questionnaire) return <Card className="lg:col-span-2"><Empty title="שאלון ההיכרות עדיין בהכנה" description="צוות PageLoom מכין את השאלון המתאים לפרויקט. הוא יופיע כאן אוטומטית." /></Card>;
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

  async function upload(field: QuestionnaireField, file?: File) {
    const uid = firebaseAuth.currentUser?.uid;
    if (!file || !uid || completed) return;
    setUploading(field.id); setError(""); setMessage("");
    try {
      const path = `organizations/${organizationId}/questionnaires/${projectId}/${questionnaire.id}/${field.id}/${uid}/${crypto.randomUUID()}-${file.name}`;
      await uploadBytes(ref(firebaseStorage, path), file, { contentType: file.type, customMetadata: { projectId, questionnaireId: questionnaire.id, fieldId: field.id } });
      setPaths(current => [...current.filter(item => !item.includes(`/${field.id}/`)), path]);
      setMessage(`הקובץ עבור „${field.label}” הועלה בהצלחה.`);
    } catch { setError(`לא הצלחנו להעלות את הקובץ עבור „${field.label}”. בדקו את סוג וגודל הקובץ ונסו שוב.`); }
    finally { setUploading(undefined); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      await api(`/projects/${projectId}/questionnaires/${questionnaire.id}/complete`, { method: "POST", body: JSON.stringify({ organizationId, responses, filePaths: paths }) });
      setMessage("השאלון התקבל בהצלחה. צוות PageLoom יכול כעת להתקדם לשלב הבא.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "לא הצלחנו לשלוח את השאלון. התשובות נשארו בעמוד כדי שתוכלו לנסות שוב."); }
    finally { setSaving(false); }
  }

  return <Card className="lg:col-span-2"><form onSubmit={submit}><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="eyebrow">שאלון היכרות · גרסה {questionnaire.version}</span><h2 className="mt-2 flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5" />{questionnaire.title}</h2><p className="mt-2 text-xs leading-5 text-[var(--muted)]">מלאו את השדות המסומנים בכוכבית. המידע והקבצים נשמרים בגבול המאובטח של הפרויקט שלכם.</p></div><Status value={questionnaire.status} /></div><fieldset disabled={completed || saving} className="mt-6 space-y-5 disabled:opacity-70">{questionnaire.fields.map(field => <label className="field" key={field.id}><span>{field.label}{field.required && " *"}</span>{field.helpText && <small className="text-[10px] leading-4 text-[var(--muted)]">{field.helpText}</small>}<QuestionnaireInput field={field} value={responses[field.id]} fileReady={paths.some(path => path.includes(`/${field.id}/`))} uploading={uploading === field.id} setValue={value => setResponses(current => ({ ...current, [field.id]: value }))} upload={file => void upload(field, file)} /></label>)}</fieldset>{!completed && <Button className="mt-6" disabled={saving || Boolean(uploading)} type="submit">{saving ? "שולחים את השאלון…" : "שליחת השאלון והמשך הפרויקט"}</Button>}{completed && <p className="mt-6 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-800"><CheckCircle2 className="h-4 w-4" />השאלון הושלם ונקלט בפרויקט.</p>}{message && <p className="mt-4 rounded-lg bg-green-50 p-3 text-xs text-green-800" role="status">{message}</p>}{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700" role="alert">{error}</p>}</form></Card>;
}

function QuestionnaireInput({ field, value, fileReady, uploading, setValue, upload }: { field: QuestionnaireField; value: string | boolean | string[] | undefined; fileReady: boolean; uploading: boolean; setValue: (value: string | boolean | string[]) => void; upload: (file?: File) => void }) {
  if (field.type === "long_text") return <textarea required={field.required} className="input min-h-28" value={String(value ?? "")} onChange={event => setValue(event.target.value)} />;
  if (field.type === "boolean") return <span className="flex items-center gap-2 text-xs"><input required={field.required} type="checkbox" checked={Boolean(value)} onChange={event => setValue(event.target.checked)} />כן</span>;
  if (field.type === "file") return <><input required={field.required && !fileReady} type="file" className="input" onChange={event => upload(event.target.files?.[0])} />{uploading && <small className="flex items-center gap-1 text-[10px] text-[var(--muted)]"><LoaderCircle className="h-3 w-3 animate-spin" />מעלים את הקובץ…</small>}{fileReady && !uploading && <small className="text-[10px] text-green-700">הקובץ נשמר בהצלחה</small>}</>;
  if (field.type === "select") return <select required={field.required} className="input" value={String(value ?? "")} onChange={event => setValue(event.target.value)}><option value="">בחירת תשובה</option>{field.options?.map(option => <option value={option} key={option}>{option}</option>)}</select>;
  if (field.type === "multi_select") { const selected = Array.isArray(value) ? value : []; return <div className="grid gap-2 sm:grid-cols-2">{field.options?.map(option => <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-3 text-xs" key={option}><input type="checkbox" checked={selected.includes(option)} onChange={event => setValue(event.target.checked ? [...selected, option] : selected.filter(item => item !== option))} />{option}</label>)}</div>; }
  return <input required={field.required} type={field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "phone" ? "tel" : "text"} className="input" value={String(value ?? "")} onChange={event => setValue(event.target.value)} />;
}
