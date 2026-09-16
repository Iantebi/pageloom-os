"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, LoaderCircle } from "lucide-react";
import { discoverySection, isQuestionVisible, missingRequiredDiscoveryFields, invalidDiscoveryFieldFormats, type DiscoverySectionId, type DiscoveryResponses } from "@pageloom/core";
import { Button } from "@/components/product-ui";
import { DiscoveryQuestionField } from "./DiscoveryQuestionField";
import { saveDiscoverySection, completeDiscoverySection, type SaveStatus } from "@/lib/discovery";
import { classifyApiErrorKind } from "@/lib/api";
import { t } from "@/lib/i18n";

const AUTOSAVE_DEBOUNCE_MS = 1500;

// One Discovery section's form: autosave (debounced + flush-on-complete), conditional question
// visibility, and local required-field validation using the exact same pure function
// (missingRequiredDiscoveryFields) the server uses — so the inline banner and the server's own
// 422 rejection can never disagree. See docs/customer-discovery-onboarding/PRD.md §11-§13.
export function DiscoverySection({ organizationId, projectId, sectionId, initialResponses, readOnly, onSectionCompleted }: {
  organizationId: string; projectId: string; sectionId: DiscoverySectionId;
  initialResponses: DiscoveryResponses; readOnly: boolean; onSectionCompleted: () => void;
}) {
  const [responses, setResponses] = useState<DiscoveryResponses>(initialResponses);
  const [status, setStatus] = useState<SaveStatus>("idle");
  // Distinguishes a save failure caused by being offline from any other cause, so the retry
  // banner can say something more accurate than a generic "save failed" when that's not why it
  // failed — see docs/customer-discovery-onboarding/PRD.md §30's error-state table.
  const [saveErrorIsOffline, setSaveErrorIsOffline] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showMissing, setShowMissing] = useState(false);
  const [showInvalid, setShowInvalid] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The latest edit not yet sent to the server. Set by update(), cleared once flush() actually
  // starts sending it. Exists so the unmount cleanup below can send a still-pending edit instead of
  // just discarding it — see that effect's comment.
  const pendingRef = useRef<DiscoveryResponses | undefined>(undefined);
  const s = t("discoveryShell"), qc = t("discoveryQuestions");
  const section = discoverySection(sectionId);
  const visibleQuestions = section.questions.filter(question => isQuestionVisible(question, responses));
  const missing = missingRequiredDiscoveryFields(section, responses);
  const invalidFormats = invalidDiscoveryFieldFormats(section, responses);

  // No reset-on-sectionId-change effect here by design: the parent renders this component with
  // key={sectionId} (see app/discovery/page.tsx), so React remounts it fresh for every section —
  // the React-recommended alternative to "adjusting state in response to a prop change" via effect.
  //
  // Bug fix (2026-09-16): clicking "Next"/"Previous" within the 1.5s debounce window used to unmount
  // this component (new key on the incoming section) while an edit was still only sitting in the
  // debounce timer, never sent — clearTimeout silently discarded it with no error, no retry, and no
  // way for the customer to know. This is exactly the data loss PRD.md §12 says autosave must never
  // cause. Fixed by sending any still-pending edit directly (bypassing flush()'s setState calls,
  // which would otherwise warn after this component has already unmounted) before clearing the timer.
  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      if (pendingRef.current) void saveDiscoverySection(organizationId, projectId, sectionId, pendingRef.current);
    }
  }, []);

  async function flush(next: DiscoveryResponses) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pendingRef.current = undefined;
    setStatus("saving");
    try {
      await saveDiscoverySection(organizationId, projectId, sectionId, next);
      setStatus("saved");
    } catch (failure) { setStatus("error"); setSaveErrorIsOffline(classifyApiErrorKind(failure) === "network"); }
  }

  function update(questionId: string, value: unknown) {
    const next = { ...responses, [questionId]: value };
    setResponses(next);
    pendingRef.current = next;
    setStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void flush(next), AUTOSAVE_DEBOUNCE_MS);
  }

  async function complete() {
    await flush(responses);
    if (missing.length > 0) { setShowMissing(true); return; }
    if (invalidFormats.length > 0) { setShowInvalid(true); return; }
    setCompleting(true);
    try {
      await completeDiscoverySection(organizationId, projectId, sectionId);
      onSectionCompleted();
    } catch { setShowMissing(true); }
    finally { setCompleting(false); }
  }

  function toggleWhy(questionId: string) {
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(questionId)) next.delete(questionId); else next.add(questionId);
      return next;
    });
  }

  return <div>
    {showMissing && missing.length > 0 && <div className="mb-5 rounded-xl bg-[var(--warn-bg)] p-3 text-xs text-[var(--warn-text)]">
      <b>{s.missingRequiredTitle(missing.length)}</b>
      <ul className="mt-1 list-inside list-disc">{missing.map(id => <li key={id}>{qc.questions[id]?.label ?? id}</li>)}</ul>
    </div>}
    {showInvalid && invalidFormats.length > 0 && <div className="mb-5 rounded-xl bg-[var(--warn-bg)] p-3 text-xs text-[var(--warn-text)]">
      <b>{s.invalidFormatTitle(invalidFormats.length)}</b>
      <ul className="mt-1 list-inside list-disc">{invalidFormats.map(id => <li key={id}>{qc.questions[id]?.label ?? id}</li>)}</ul>
    </div>}

    <fieldset disabled={readOnly} className="space-y-6 disabled:opacity-70">
      {visibleQuestions.map(question => {
        const copy = qc.questions[question.id];
        // A screen reader needs a programmatic label-to-control association, not just visual
        // proximity — <label htmlFor> covers the single-input types (short_text/email/phone/
        // url/date/long_text/select, see DiscoveryQuestionField.tsx's matching id={question.id}
        // below); role="group" + aria-labelledby on the field wrapper additionally covers every
        // composite type (multi_select checkboxes, color_pair swatches, address, repeaters,
        // uploads) uniformly, without needing per-control ids threaded through 10 different
        // rendering branches. Fixes a real gap: PRD.md §29 already documented "every input has a
        // visible, associated label" as a requirement, but the association was visual-only.
        return <div className="field" key={question.id}>
          <div className="flex items-start justify-between gap-3">
            <label id={`${question.id}-label`} htmlFor={question.id} className="text-xs font-medium">{copy?.label ?? question.id}{question.required && " *"}</label>
            {copy?.whyWeAsk && <button type="button" className="flex items-center gap-1 text-[10px] text-[var(--muted)]" onClick={() => toggleWhy(question.id)}>
              <Info className="h-3 w-3" />{s.whyWeAskToggle}
            </button>}
          </div>
          {copy?.helpText && <small className="mt-1 block text-[10px] leading-4 text-[var(--muted)]">{copy.helpText}</small>}
          {copy?.whyWeAsk && expanded.has(question.id) && <p className="mt-2 rounded-lg bg-[var(--surface-2)] p-2 text-[10px] leading-5 text-[var(--muted)]">{copy.whyWeAsk}</p>}
          <div className="mt-2" role="group" aria-labelledby={`${question.id}-label`}>
            <DiscoveryQuestionField question={question} value={responses[question.id]} organizationId={organizationId} projectId={projectId} sectionId={sectionId} onChange={value => update(question.id, value)} />
          </div>
        </div>;
      })}
    </fieldset>

    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <SaveStatusIndicator status={status} offline={saveErrorIsOffline} onRetry={() => void flush(responses)} />
      {!readOnly && <Button disabled={completing} onClick={() => void complete()}>
        {completing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{s.finishSection}
      </Button>}
    </div>
  </div>;
}

function SaveStatusIndicator({ status, offline, onRetry }: { status: SaveStatus; offline: boolean; onRetry: () => void }) {
  const s = t("discoveryShell");
  if (status === "idle") return <span />;
  if (status === "saving") return <span className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]"><LoaderCircle className="h-3 w-3 animate-spin" />{s.savingStatus}</span>;
  // A network-caused failure gets the more accurate, reassuring message ("your answer is kept
  // with you until the connection returns") instead of a generic "save failed" — the typed text
  // is never lost either way (pendingRef/local state keep it), but the message should say so.
  if (status === "error") return <button type="button" onClick={onRetry} className="text-[10px] text-[var(--danger-text)] underline">{offline ? s.networkOffline : s.saveErrorStatus}</button>;
  return <span className="flex items-center gap-1.5 text-[10px] text-[var(--success-text)]"><CheckCircle2 className="h-3 w-3" />{s.savedStatus}</span>;
}
