"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, MessageSquarePlus, Sparkles } from "lucide-react";
import { discoverySectionOrder, type DiscoverySectionId, type Project } from "@pageloom/core";
import { useDiscovery, markDiscoveryReviewed, reopenDiscoverySection, loadDiscoveryNotes, addDiscoveryNote, type DiscoveryNote } from "@/lib/discovery";
import { Button, Card, dateTime } from "./product-ui";
import { t } from "@/lib/i18n";

// Staff-facing Business Discovery review surface — extends (does not replace) the existing
// onboarding tab alongside OnboardingJourneyPanel. See docs/customer-discovery-onboarding/UX-FLOW.md §6.
export function DiscoveryPanel({ organizationId, project }: { organizationId: string; project: Project }) {
  const { state, loading, reload } = useDiscovery(organizationId, project.id);
  const [reopenTarget, setReopenTarget] = useState<DiscoverySectionId>();
  const [busy, setBusy] = useState(false);
  const s = t("discoveryPanel"), qc = t("discoveryQuestions");

  if (loading && !state) return <Card aria-busy="true"><h3 className="text-sm font-semibold">{s.title}</h3><p className="mt-3 text-xs text-[var(--muted)]">{s.loading}</p></Card>;
  if (!state?.progress) return null; // Discovery not started for this project — nothing to show yet.

  const progress = state.progress;
  const statusLabel = { not_started: s.statusNotStarted, in_progress: s.statusInProgress, submitted: s.statusSubmitted, reviewed: s.statusReviewed, reopened: s.statusReopened }[progress.status];

  async function markReviewed() {
    setBusy(true);
    try { await markDiscoveryReviewed(organizationId, project.id); await reload(); } finally { setBusy(false); }
  }

  return <Card>
    <div className="flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4" />{s.title}</h3>
      <span className="status status-idle"><i aria-hidden="true" />{statusLabel}</span>
    </div>

    <div className="mt-4 divide-y divide-[var(--border)]">
      {discoverySectionOrder.map(id => {
        const section = state.sections[id];
        const status = section?.status === "completed" ? s.sectionCompleted : section ? s.sectionDraft : s.sectionNotStarted;
        return <div className="flex items-center justify-between gap-3 py-2.5" key={id}>
          <div className="flex items-center gap-2">
            {section?.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success-text)]" /> : <span className="h-3.5 w-3.5 rounded-full border border-[var(--border)]" />}
            <span className="text-xs">{qc.sections[id].title}</span>
            <span className="text-[9px] text-[var(--muted)]">· {status}</span>
          </div>
          {section?.status === "completed" && <button type="button" className="text-[10px] text-[var(--accent)] underline" onClick={() => setReopenTarget(id)}>{s.reopenAction}</button>}
        </div>;
      })}
    </div>

    {progress.status === "submitted" && <Button variant="secondary" className="mt-4" disabled={busy} onClick={() => void markReviewed()}>{s.markReviewed}</Button>}

    {reopenTarget && <ReopenDialog organizationId={organizationId} projectId={project.id} sectionId={reopenTarget} onClose={() => setReopenTarget(undefined)} onDone={() => { setReopenTarget(undefined); void reload(); }} />}

    <DiscoveryNotes organizationId={organizationId} projectId={project.id} />
  </Card>;
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
