"use client";

import { useState } from "react";
import { ref, uploadBytes } from "firebase/storage";
import { CheckCircle2, Eye, LoaderCircle, RotateCcw, Send, UploadCloud } from "lucide-react";
import { type Project } from "@pageloom/core";
import { firebaseAuth, firebaseStorage } from "@/lib/firebase";
import { api } from "@/lib/api";
import { useOrganization } from "@/lib/organization";
import { useLiveCollection } from "@/lib/live-data";
import { Button, Card, Empty, PageHeader, Status } from "@/components/product-ui";

const stages: Record<string, string> = {
  lead: "ליד", questionnaire: "שאלון", assets: "איסוף חומרים", research: "מחקר",
  brand_strategy: "אסטרטגיית מותג", design_system: "מערכת עיצוב", sitemap: "מפת אתר",
  ux_planning: "תכנון חוויית משתמש", ui_generation: "עיצוב", copywriting: "כתיבה",
  seo: "קידום אורגני", development: "פיתוח", qa: "בדיקות איכות",
  customer_review: "בדיקת הלקוח", revision: "שינויים", final_deployment: "פרסום סופי",
  completed: "הושלם",
};

export default function Portal() {
  const { organizationId, membership } = useOrganization();
  const client = membership?.role === "client";
  const projects = useLiveCollection<Project>(organizationId ? `organizations/${organizationId}/projects` : undefined, "updatedAt", 100, client ? "customerId" : undefined, client ? membership.customerId : undefined);
  const [id, setId] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const project = projects.data.find(item => item.id === id) ?? projects.data[0];
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
    <PageHeader eyebrow="האזור האישי שלכם" title="פורטל הלקוחות" description="עקבו אחר ההתקדמות, העלו חומרים, צפו באתר והשאירו החלטה ברורה לצוות הפרויקט." />
    {projects.error && <Card role="alert"><p className="text-xs text-red-700">לא הצלחנו לטעון את הפרויקטים. רעננו את העמוד; אם הבעיה נמשכת, פנו לתמיכה.</p></Card>}
    {projects.loading && !projects.data.length ? <Card aria-busy="true"><div className="flex min-h-40 items-center justify-center gap-2 text-xs text-[var(--muted)]"><LoaderCircle className="h-4 w-4 animate-spin" />טוענים את הפרויקט שלכם…</div></Card> : project ? <>
      {projects.data.length > 1 && <Card><label className="field"><span>בחירת פרויקט</span><select className="input" value={project.id} onChange={event => setId(event.target.value)}>{projects.data.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></Card>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card aria-label="התקדמות הפרויקט"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">התקדמות הפרויקט</h2><p className="mt-1 text-xs text-[var(--muted)]">השלב הנוכחי: {stages[project.workflowStage ?? project.journeyStage] ?? "בטיפול"}</p></div><Status value={project.workflowStatus ?? project.status} /></div><b className="mt-5 block text-3xl" aria-label={`${project.progress} אחוזים`}>{project.progress}%</b><div className="progress mt-4" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={project.progress}><i style={{ width: `${project.progress}%` }} /></div>{project.blockedReason && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">הפרויקט ממתין לטיפול צוות PageLoom. אין צורך בפעולה מצדכם כרגע.</p>}</Card>
        <Card><h2 className="text-sm font-semibold">חומרים לפרויקט</h2><p className="mt-2 text-xs leading-5 text-[var(--muted)]">העלו לוגו, תמונות, טקסטים ומסמכים שישמשו באתר. יש להעלות רק חומרים שבבעלותכם או שקיבלתם רשות להשתמש בהם.</p><label className="button button-secondary mt-5 cursor-pointer justify-center"><UploadCloud className="h-4 w-4" />{busy ? "מעלים…" : "בחירת קובץ"}<input className="sr-only" type="file" disabled={busy} onChange={upload} /></label></Card>
        {websiteUrl && <Card className="lg:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">תצוגה מקדימה של האתר</h2><p className="mt-1 text-xs text-[var(--muted)]">הקישור נפתח בחלון חדש. חזרו לכאן כדי לשלוח הערות או אישור.</p></div><a className="button button-secondary" href={websiteUrl} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" />פתיחת האתר</a></div></Card>}
        <Card className="lg:col-span-2"><h2 className="text-sm font-semibold">הערות ואישור</h2><label className="field mt-4"><span>הערה לצוות</span><textarea className="input min-h-28" value={comment} onChange={event => setComment(event.target.value)} placeholder="רכזו כאן הערות מדויקות לפי עמוד או אזור באתר" maxLength={4000} /></label><div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" disabled={!comment.trim() || busy} onClick={() => void send()}><Send className="h-4 w-4" />שליחת הערה</Button>{project.workflowStage === "customer_review" && <><Button variant="secondary" disabled={busy} onClick={() => void review("CustomerRequestedRevision")}><RotateCcw className="h-4 w-4" />בקשת שינויים</Button><Button disabled={busy} onClick={() => void review("CustomerApproved")}><CheckCircle2 className="h-4 w-4" />אישור האתר</Button></>}</div>{message && <p className="mt-4 rounded-lg bg-green-50 p-3 text-xs text-green-800" role="status">{message}</p>}{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700" role="alert">{error}</p>}</Card>
      </div>
    </> : <Card><Empty title="עדיין אין פרויקט להצגה" description="כאשר הפרויקט שלכם יהיה מוכן, הוא יופיע כאן באופן אוטומטי." /></Card>}
  </div>;
}
