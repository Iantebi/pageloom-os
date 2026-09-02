"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, PartyPopper } from "lucide-react";
import { discoverySectionOrder, discoverySection, missingRequiredDiscoveryFields, type DiscoverySectionId, type DiscoveryResponses } from "@pageloom/core";
import { useOrganization } from "@/lib/organization";
import { useDiscovery, submitDiscovery } from "@/lib/discovery";
import { Button, Card, Empty, Loading } from "@/components/product-ui";
import { DiscoveryStepper, DiscoveryStagesMenu } from "@/components/discovery/DiscoveryStepper";
import { DiscoverySection } from "@/components/discovery/DiscoverySection";
import { t } from "@/lib/i18n";

export default function DiscoveryPage() {
  return <Suspense fallback={<Loading />}><DiscoveryScreen /></Suspense>;
}

function DiscoveryScreen() {
  const projectId = useSearchParams().get("projectId") ?? "";
  const { organizationId } = useOrganization();
  const { state, loading, error, reload } = useDiscovery(organizationId, projectId);
  // Only explicit user navigation (clicking a stepper step, "next", or completing a section) ever
  // calls this setter — the *default* section is derived from `state` at render time below, never
  // set via an effect (React's own guidance: don't sync state from a prop/async value in an effect
  // when it can be computed directly during render).
  const [selectedSectionId, setSelectedSectionId] = useState<DiscoverySectionId>();
  const [reviewing, setReviewing] = useState(false);
  const s = t("discoveryShell");

  if (!projectId) return <Shell><Card><Empty title={s.loadError} description="" /></Card></Shell>;
  if (loading && !state) return <Shell><Loading /></Shell>;
  if (error) return <Shell><Card role="alert"><p className="text-xs text-[var(--danger-text)]">{s.loadError}</p></Card></Shell>;
  if (!state) return <Shell><Loading /></Shell>;

  const firstIncomplete = discoverySectionOrder.find(id => !(state.progress?.completedSectionIds ?? []).includes(id));
  const currentSectionId = selectedSectionId ?? state.progress?.currentSectionId ?? firstIncomplete ?? discoverySectionOrder[0];
  const setCurrentSectionId = setSelectedSectionId;
  const progress = state.progress;
  const completedSectionIds = progress?.completedSectionIds ?? [];

  if (progress?.status === "submitted" || progress?.status === "reviewed") {
    return <Shell><CompletionScreen /></Shell>;
  }

  const reopenedSections = discoverySectionOrder.filter(id => {
    const section = state.sections[id];
    return section?.status === "draft" && section.reopenReason;
  });

  if (reviewing) {
    return <Shell>
      <ReviewScreen organizationId={organizationId} projectId={projectId} state={state} onEdit={id => { setCurrentSectionId(id); setReviewing(false); }} onBack={() => setReviewing(false)} onSubmitted={reload} />
    </Shell>;
  }

  const index = discoverySectionOrder.indexOf(currentSectionId);
  const isLast = index === discoverySectionOrder.length - 1;
  const qc = t("discoveryQuestions");
  const percent = progress?.percentComplete ?? 0;

  return <Shell>
    {reopenedSections.length > 0 && <div className="mb-5 rounded-xl bg-[var(--warn-bg)] p-4 text-xs text-[var(--warn-text)]">
      <b>{s.needsMoreInfoTitle}</b>
      <ul className="mt-2 space-y-1">
        {reopenedSections.map(id => <li key={id}>
          <button type="button" className="underline" onClick={() => setCurrentSectionId(id)}>{s.needsMoreInfoCta}: {qc.sections[id].title}</button>
          {state.sections[id]?.reopenReason && <span> — {state.sections[id]!.reopenReason}</span>}
        </li>)}
      </ul>
    </div>}

    <div className="mb-6">
      <DiscoveryStepper currentSectionId={currentSectionId} completedSectionIds={completedSectionIds} onSelect={setCurrentSectionId} />
    </div>
    <DiscoveryStagesMenu currentSectionId={currentSectionId} completedSectionIds={completedSectionIds} onSelect={setCurrentSectionId} />

    <Card className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">{s.stepLabel(index + 1, discoverySectionOrder.length)}</span>
        <span className="text-[10px] text-[var(--muted)]">{s.percentComplete(percent)}</span>
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-[-.02em]">{qc.sections[currentSectionId].title}</h1>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{qc.sections[currentSectionId].description}</p>
      <div className="progress mt-4" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{ width: `${percent}%` }} /></div>

      <div className="mt-8">
        <DiscoverySection
          key={currentSectionId}
          organizationId={organizationId} projectId={projectId} sectionId={currentSectionId}
          initialResponses={(state.sections[currentSectionId]?.responses ?? {}) as DiscoveryResponses}
          readOnly={false}
          onSectionCompleted={() => {
            void reload();
            if (isLast) setReviewing(true);
            else setCurrentSectionId(discoverySectionOrder[index + 1]);
          }}
        />
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-[var(--border)] pt-5">
        <Button variant="secondary" disabled={index === 0} onClick={() => setCurrentSectionId(discoverySectionOrder[index - 1])}><ArrowRight className="h-4 w-4" />{s.previous}</Button>
        {isLast
          ? <Button variant="secondary" onClick={() => setReviewing(true)}>{s.reviewAndSubmit}</Button>
          : <Button variant="secondary" onClick={() => setCurrentSectionId(discoverySectionOrder[index + 1])}>{s.next}<ArrowLeft className="h-4 w-4" /></Button>}
      </div>
    </Card>
  </Shell>;
}

function ReviewScreen({ organizationId, projectId, state, onEdit, onBack, onSubmitted }: {
  organizationId: string; projectId: string;
  state: { progress: { completedSectionIds: DiscoverySectionId[] } | null; sections: Record<string, { responses: DiscoveryResponses; status: string }> };
  onEdit: (sectionId: DiscoverySectionId) => void; onBack: () => void; onSubmitted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const s = t("discoveryShell"), qc = t("discoveryQuestions");
  const outstanding = discoverySectionOrder.flatMap(id => {
    const responses = state.sections[id]?.responses ?? {};
    return missingRequiredDiscoveryFields(discoverySection(id), responses).length > 0 ? [id] : [];
  });

  async function submit() {
    setBusy(true); setError("");
    try { await submitDiscovery(organizationId, projectId); onSubmitted(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : s.submitError); }
    finally { setBusy(false); }
  }

  return <Card>
    <h1 className="text-2xl font-semibold tracking-[-.02em]">{s.reviewTitle}</h1>
    <p className="mt-2 text-xs text-[var(--muted)]">{s.reviewDescription}</p>
    <div className="mt-6 divide-y divide-[var(--border)]">
      {discoverySectionOrder.map(id => {
        const complete = state.sections[id]?.status === "completed";
        return <div className="flex items-center justify-between gap-3 py-3" key={id}>
          <div className="flex items-center gap-2">
            {complete ? <CheckCircle2 className="h-4 w-4 text-[var(--success-text)]" /> : <span className="h-4 w-4 rounded-full border border-[var(--border)]" />}
            <span className="text-xs">{qc.sections[id].title}</span>
          </div>
          <button type="button" className="text-[10px] text-[var(--accent)] underline" onClick={() => onEdit(id)}>{s.reviewEdit}</button>
        </div>;
      })}
    </div>
    {outstanding.length > 0 && <p className="mt-4 rounded-lg bg-[var(--warn-bg)] p-3 text-xs text-[var(--warn-text)]">{s.missingRequiredTitle(outstanding.length)}</p>}
    {error && <p className="mt-4 rounded-lg bg-[var(--danger-bg)] p-3 text-xs text-[var(--danger-text)]" role="alert">{error}</p>}
    <div className="mt-6 flex flex-wrap gap-2">
      <Button variant="secondary" onClick={onBack}><ArrowRight className="h-4 w-4" />{s.previous}</Button>
      <Button disabled={busy || outstanding.length > 0} onClick={() => void submit()}>{busy ? s.submitting : s.submitDiscovery}</Button>
    </div>
  </Card>;
}

function CompletionScreen() {
  const s = t("discoveryShell"), qc = t("discoveryQuestions");
  return <Card>
    <div className="grid place-items-center py-6 text-center">
      <span className="icon-box"><PartyPopper className="h-6 w-6" aria-hidden="true" /></span>
      <h1 className="mt-4 text-2xl font-semibold tracking-[-.02em]">{s.completionTitle}</h1>
      <p className="mt-3 max-w-md text-xs leading-6 text-[var(--muted)]">{s.completionBody}</p>
    </div>
    <div className="mt-4 border-t border-[var(--border)] pt-5">
      <h2 className="text-xs font-semibold text-[var(--muted)]">{s.completionSectionsTitle}</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {discoverySectionOrder.map(id => <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2 text-[10px]" key={id}>
          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success-text)]" />{qc.sections[id].title}
        </div>)}
      </div>
    </div>
    <Link href="/portal"><Button className="mt-6">{s.completionBackCta}</Button></Link>
  </Card>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const s = t("discoveryShell");
  return <div className="mx-auto max-w-3xl px-4 py-8">
    <header className="mb-8 flex items-center justify-between">
      <Link href="/portal" className="flex items-center gap-2.5 text-sm font-semibold"><span className="logo-mark">P</span><span>{s.brandName}</span></Link>
      <Link href="/portal" className="text-xs text-[var(--muted)]">{s.backToProjectCenter}</Link>
    </header>
    {children}
  </div>;
}
