"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { discoverySectionOrder, type DiscoverySectionId, type DiscoveryResponses } from "@pageloom/core";
import { useOrganization } from "@/lib/organization";
import { useDiscovery } from "@/lib/discovery";
import { Button, Card, Empty, Loading } from "@/components/product-ui";
import { DiscoveryStepper, DiscoveryStagesMenu } from "@/components/discovery/DiscoveryStepper";
import { DiscoverySection } from "@/components/discovery/DiscoverySection";
import { DiscoveryShell, ReviewScreen, CompletionScreen } from "@/components/discovery/DiscoveryScreens";
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

  if (!projectId) return <DiscoveryShell><Card><Empty title={s.loadError} description="" /></Card></DiscoveryShell>;
  if (loading && !state) return <DiscoveryShell><Loading /></DiscoveryShell>;
  if (error) return <DiscoveryShell><Card role="alert"><p className="text-xs text-[var(--danger-text)]">{s.loadError}</p></Card></DiscoveryShell>;
  if (!state) return <DiscoveryShell><Loading /></DiscoveryShell>;

  const firstIncomplete = discoverySectionOrder.find(id => !(state.progress?.completedSectionIds ?? []).includes(id));
  const currentSectionId = selectedSectionId ?? state.progress?.currentSectionId ?? firstIncomplete ?? discoverySectionOrder[0];
  const setCurrentSectionId = setSelectedSectionId;
  const progress = state.progress;
  const completedSectionIds = progress?.completedSectionIds ?? [];

  if (progress?.status === "submitted" || progress?.status === "reviewed") {
    return <DiscoveryShell><CompletionScreen /></DiscoveryShell>;
  }

  const reopenedSections = discoverySectionOrder.filter(id => {
    const section = state.sections[id];
    return section?.status === "draft" && section.reopenReason;
  });

  if (reviewing) {
    return <DiscoveryShell>
      <ReviewScreen organizationId={organizationId} projectId={projectId} state={state} onEdit={id => { setCurrentSectionId(id); setReviewing(false); }} onBack={() => setReviewing(false)} onSubmitted={reload} />
    </DiscoveryShell>;
  }

  const index = discoverySectionOrder.indexOf(currentSectionId);
  const isLast = index === discoverySectionOrder.length - 1;
  const qc = t("discoveryQuestions");
  const percent = progress?.percentComplete ?? 0;

  return <DiscoveryShell>
    {reopenedSections.length > 0 && <div className="mb-5 rounded-xl bg-[var(--warn-bg)] p-4 text-xs text-[var(--warn-text)]">
      <b>{s.needsMoreInfoTitle}</b>
      <ul className="mt-2 space-y-1">
        {reopenedSections.map(id => <li key={id}>
          <button type="button" className="underline" onClick={() => setCurrentSectionId(id)}>{s.needsMoreInfoCta}: {qc.sections[id].title}</button>
          {state.sections[id]?.reopenReason && <span> — {state.sections[id]!.reopenReason}</span>}
        </li>)}
      </ul>
    </div>}

    {/* Mobile gets the compact "שלבים" dropdown only; desktop gets the full rail only — the two
        are alternatives, not additive (UX-FLOW.md §4.6: "no permanent sidebar on mobile — a
        compact control replaces any desktop step list"). */}
    <div className="mb-6 hidden sm:block">
      <DiscoveryStepper currentSectionId={currentSectionId} completedSectionIds={completedSectionIds} onSelect={setCurrentSectionId} />
    </div>
    <div className="mb-6 sm:hidden">
      <DiscoveryStagesMenu currentSectionId={currentSectionId} completedSectionIds={completedSectionIds} onSelect={setCurrentSectionId} />
    </div>

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
  </DiscoveryShell>;
}

