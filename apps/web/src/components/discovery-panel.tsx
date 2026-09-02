"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, MessageSquarePlus, Sparkles } from "lucide-react";
import { discoverySectionOrder, discoverySection, isQuestionVisible, missingRequiredDiscoveryFields, type DiscoverySectionId, type Project } from "@pageloom/core";
import { useDiscovery, markDiscoveryReviewed, reopenDiscoverySection, loadDiscoveryNotes, addDiscoveryNote, type DiscoveryNote } from "@/lib/discovery";
import { Button, Card, dateTime } from "./product-ui";
import { t } from "@/lib/i18n";

// Staff-facing Business Discovery review surface — extends (does not replace) the existing
// onboarding tab alongside OnboardingJourneyPanel. See docs/customer-discovery-onboarding/UX-FLOW.md §6.
// Shows everything an Owner/Admin needs without opening the raw Firestore console: status, percent,
// current section, missing information, last activity, submitted date, per-section answers, and
// internal notes (never customer-visible — see SECURITY.md §3.3).
export function DiscoveryPanel({ organizationId, project }: { organizationId: string; project: Project }) {
  const { state, loading, reload } = useDiscovery(organizationId, project.id);
  const [reopenTarget, setReopenTarget] = useState<DiscoverySectionId>();
  const [expandedSectionId, setExpandedSectionId] = useState<DiscoverySectionId>();
  const [busy, setBusy] = useState(false);
  const s = t("discoveryPanel"), qc = t("discoveryQuestions");

  if (loading && !state) return <Card aria-busy="true"><h3 className="text-sm font-semibold">{s.title}</h3><p className="mt-3 text-xs text-[var(--muted)]">{s.loading}</p></Card>;
  if (!state?.progress) return null; // Discovery not started for this project — nothing to show yet.

  const progress = state.progress;
  const statusLabel = { not_started: s.statusNotStarted, in_progress: s.statusInProgress, submitted: s.statusSubmitted, reviewed: s.statusReviewed, reopened: s.statusReopened }[progress.status];
  const currentSectionLabel = progress.currentSectionId ? qc.sections[progress.currentSectionId].title : "—";
  const nextAction = progress.status === "not_started" || progress.status === "in_progress" || progress.status === "reopened"
    ? s.nextActionWaitingOnCustomer(currentSectionLabel)
    : progress.status === "submitted" ? s.nextActionReadyForReview : s.nextActionNone;

  async function markReviewed() {
    setBusy(true);
    try { await markDiscoveryReviewed(organizationId, project.id); await reload(); } finally { setBusy(false); }
  }

  return <Card>
    <div className="flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4" />{s.title}</h3>
      <span className="status status-idle"><i aria-hidden="true" />{statusLabel}</span>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label={s.statPercent} value={`${progress.percentComplete}%`} />
      <Stat label={s.statCurrentSection} value={currentSectionLabel} />
      <Stat label={s.statLastActivity} value={progress.lastActivityAt ? dateTime(progress.lastActivityAt) : "—"} />
      <Stat label={s.statSubmittedAt} value={progress.submittedAt ? dateTime(progress.submittedAt) : "—"} />
    </div>
    <p className="mt-3 rounded-lg bg-[var(--surface-2)] p-2.5 text-[10px] text-[var(--muted)]">{s.nextActionLabel}: {nextAction}</p>

    <div className="mt-4 divide-y divide-[var(--border)]">
      {discoverySectionOrder.map(id => {
        const section = state.sections[id];
        const status = section?.status === "completed" ? s.sectionCompleted : section ? s.sectionDraft : s.sectionNotStarted;
        const missing = section ? missingRequiredDiscoveryFields(discoverySection(id), section.responses) : [];
        const expanded = expandedSectionId === id;
        return <div className="py-2.5" key={id}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {section?.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success-text)]" /> : <span className="h-3.5 w-3.5 rounded-full border border-[var(--border)]" />}
              <span className="text-xs">{qc.sections[id].title}</span>
              <span className="text-[9px] text-[var(--muted)]">· {status}</span>
              {missing.length > 0 && <span className="text-[9px] text-[var(--warn-text)]">· {s.missingCount(missing.length)}</span>}
            </div>
            <div className="flex items-center gap-3">
              {section && <button type="button" className="flex items-center gap-1 text-[10px] text-[var(--accent)] underline" onClick={() => setExpandedSectionId(expanded ? undefined : id)}>
                {expanded ? s.hideFullAnswers : s.viewFullAnswers}{expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>}
              {section?.status === "completed" && <button type="button" className="text-[10px] text-[var(--accent)] underline" onClick={() => setReopenTarget(id)}>{s.reopenAction}</button>}
            </div>
          </div>
          {expanded && section && <SectionAnswers sectionId={id} responses={section.responses} />}
        </div>;
      })}
    </div>

    {progress.status === "submitted" && <Button variant="secondary" className="mt-4" disabled={busy} onClick={() => void markReviewed()}>{s.markReviewed}</Button>}

    {reopenTarget && <ReopenDialog organizationId={organizationId} projectId={project.id} sectionId={reopenTarget} onClose={() => setReopenTarget(undefined)} onDone={() => { setReopenTarget(undefined); void reload(); }} />}

    <DiscoveryNotes organizationId={organizationId} projectId={project.id} />
  </Card>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[var(--border)] p-2.5">
    <span className="block text-[9px] text-[var(--muted)]">{label}</span>
    <b className="mt-1 block truncate text-xs">{value}</b>
  </div>;
}

function SectionAnswers({ sectionId, responses }: { sectionId: DiscoverySectionId; responses: Record<string, unknown> }) {
  const s = t("discoveryPanel"), qc = t("discoveryQuestions"), shell = t("discoveryShell");
  const section = discoverySection(sectionId);
  return <div className="mt-3 space-y-2 rounded-xl bg-[var(--surface-2)] p-3">
    {section.questions.map(question => {
      const visible = isQuestionVisible(question, responses);
      const value = responses[question.id];
      const answered = value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
      return <div key={question.id}>
        <b className="block text-[10px] text-[var(--muted)]">{qc.questions[question.id]?.label ?? question.id}</b>
        <p className="text-[11px]">
          {!visible ? <span className="text-[var(--muted)]">{s.notApplicable}</span>
            : !answered ? <span className="text-[var(--muted)]">{s.noAnswer}</span>
            : Array.isArray(value) ? value.map(item => typeof item === "string" ? item : JSON.stringify(item)).join(", ")
            : typeof value === "boolean" ? (value ? shell.yesLabel : shell.noLabel)
            : typeof value === "object" ? JSON.stringify(value)
            : String(value)}
        </p>
      </div>;
    })}
  </div>;
}

function ReopenDialog({ organizationId, projectId, sectionId, onClose, onDone }: { organizationId: string; projectId: string; sectionId: DiscoverySectionId; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const s = t("discoveryPanel"), qc = t("discoveryQuestions");
  async function submit() {
    if (!reason.trim()) return;
    setBusy(true);
    try { await reopenDiscoverySection(organizationId, projectId, sectionId, reason.trim()); onDone(); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop">
    <div className="modal text-start">
      <h2 className="text-lg font-semibold">{s.reopenDialogTitle}: {qc.sections[sectionId].title}</h2>
      <label className="field mt-4"><span>{s.reopenReasonLabel}</span><textarea className="input min-h-24" value={reason} onChange={event => setReason(event.target.value)} placeholder={s.reopenReasonPlaceholder} maxLength={1000} /></label>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{s.reopenCancel}</Button>
        <Button disabled={busy || !reason.trim()} onClick={() => void submit()}>{s.reopenSubmit}</Button>
      </div>
    </div>
  </div>;
}

function DiscoveryNotes({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const [notes, setNotes] = useState<DiscoveryNote[]>();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const s = t("discoveryPanel");

  useEffect(() => { let active = true; void loadDiscoveryNotes(organizationId, projectId).then(result => { if (active) setNotes(result); }); return () => { active = false; }; }, [organizationId, projectId]);

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const note = await addDiscoveryNote(organizationId, projectId, body.trim());
      setNotes(current => [note, ...(current ?? [])]);
      setBody("");
    } finally { setBusy(false); }
  }

  return <div className="mt-6 border-t border-[var(--border)] pt-5">
    <h4 className="flex items-center gap-2 text-xs font-semibold"><MessageSquarePlus className="h-4 w-4" />{s.addNote}</h4>
    <div className="mt-2 flex gap-2">
      <input className="input" value={body} onChange={event => setBody(event.target.value)} placeholder={s.notePlaceholder} maxLength={2000} />
      <Button variant="secondary" disabled={busy || !body.trim()} onClick={() => void submit()}>{s.saveNote}</Button>
    </div>
    <div className="mt-3 space-y-2">
      {!notes?.length && <p className="text-[10px] text-[var(--muted)]">{s.noNotes}</p>}
      {notes?.map(note => <div className="rounded-lg border border-[var(--border)] p-2" key={note.id}>
        <p className="text-[11px]">{note.body}</p>
        <small className="mt-1 block text-[9px] text-[var(--muted)]">{note.authorName} · {dateTime(note.createdAt)}</small>
      </div>)}
    </div>
  </div>;
}
