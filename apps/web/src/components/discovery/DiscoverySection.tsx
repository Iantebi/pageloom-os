"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, LoaderCircle } from "lucide-react";
import { discoverySection, isQuestionVisible, missingRequiredDiscoveryFields, type DiscoverySectionId, type DiscoveryResponses } from "@pageloom/core";
import { Button } from "@/components/product-ui";
import { DiscoveryQuestionField } from "./DiscoveryQuestionField";
import { saveDiscoverySection, completeDiscoverySection, type SaveStatus } from "@/lib/discovery";
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
  const [completing, setCompleting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showMissing, setShowMissing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const s = t("discoveryShell"), qc = t("discoveryQuestions");
  const section = discoverySection(sectionId);
  const visibleQuestions = section.questions.filter(question => isQuestionVisible(question, responses));
  const missing = missingRequiredDiscoveryFields(section, responses);

  // No reset-on-sectionId-change effect here by design: the parent renders this component with
  // key={sectionId} (see app/discovery/page.tsx), so React remounts it fresh for every section —
  // the React-recommended alternative to "adjusting state in response to a prop change" via effect.
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  async function flush(next: DiscoveryResponses) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setStatus("saving");
    try {
      await saveDiscoverySection(organizationId, projectId, sectionId, next);
      setStatus("saved");
    } catch { setStatus("error"); }
  }

  function update(questionId: string, value: unknown) {
    const next = { ...responses, [questionId]: value };
    setResponses(next);
    setStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void flush(next), AUTOSAVE_DEBOUNCE_MS);
  }

  async function complete() {
    await flush(responses);
    if (missing.length > 0) { setShowMissing(true); return; }
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

    <fieldset disabled={readOnly} className="space-y-6 disabled:opacity-70">
      {visibleQuestions.map(question => {
        const copy = qc.questions[question.id];
        return <div className="field" key={question.id}>
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-medium">{copy?.label ?? question.id}{question.required && " *"}</span>
            {copy?.whyWeAsk && <button type="button" className="flex items-center gap-1 text-[10px] text-[var(--muted)]" onClick={() => toggleWhy(question.id)}>
              <Info className="h-3 w-3" />{s.whyWeAskToggle}
            </button>}
          </div>
          {copy?.helpText && <small className="mt-1 block text-[10px] leading-4 text-[var(--muted)]">{copy.helpText}</small>}
          {copy?.whyWeAsk && expanded.has(question.id) && <p className="mt-2 rounded-lg bg-[var(--surface-2)] p-2 text-[10px] leading-5 text-[var(--muted)]">{copy.whyWeAsk}</p>}
          <div className="mt-2">
            <DiscoveryQuestionField question={question} value={responses[question.id]} organizationId={organizationId} projectId={projectId} sectionId={sectionId} onChange={value => update(question.id, value)} />
          </div>
        </div>;
      })}
    </fieldset>

    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <SaveStatusIndicator status={status} onRetry={() => void flush(responses)} />
      {!readOnly && <Button disabled={completing} onClick={() => void complete()}>
        {completing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{s.finishSection}
      </Button>}
    </div>
  </div>;
}

function SaveStatusIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  const s = t("discoveryShell");
  if (status === "idle") return <span />;
  if (status === "saving") return <span className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]"><LoaderCircle className="h-3 w-3 animate-spin" />{s.savingStatus}</span>;
  if (status === "error") return <button type="button" onClick={onRetry} className="text-[10px] text-[var(--danger-text)] underline">{s.saveErrorStatus}</button>;
  return <span className="flex items-center gap-1.5 text-[10px] text-[var(--success-text)]"><CheckCircle2 className="h-3 w-3" />{s.savedStatus}</span>;
}
