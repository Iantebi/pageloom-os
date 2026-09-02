"use client";
import { Check } from "lucide-react";
import { discoverySectionOrder, type DiscoverySectionId } from "@pageloom/core";
import { t } from "@/lib/i18n";

// The 9-step Discovery rail — reuses the exact visual pattern already established by
// customer-journey-timeline.tsx / workflow-timeline.tsx (circle/checkmark/connecting-line), rather
// than inventing a new stepper language. See docs/customer-discovery-onboarding/UX-FLOW.md §4.1/§4.6.
export function DiscoveryStepper({ currentSectionId, completedSectionIds, onSelect }: {
  currentSectionId: DiscoverySectionId; completedSectionIds: readonly DiscoverySectionId[]; onSelect: (sectionId: DiscoverySectionId) => void;
}) {
  const qc = t("discoveryQuestions");
  const position = discoverySectionOrder.indexOf(currentSectionId);
  return <div className="overflow-x-auto pb-2">
    <div className="flex min-w-[720px] items-start sm:min-w-0">
      {discoverySectionOrder.map((sectionId, index) => {
        const done = completedSectionIds.includes(sectionId);
        const current = sectionId === currentSectionId;
        return <button type="button" key={sectionId} onClick={() => onSelect(sectionId)}
          className="relative flex min-w-16 flex-1 flex-col items-center text-center">
          {index > 0 && <i className={`absolute end-1/2 top-3 h-px w-full ${index <= position || done ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />}
          <span className={`relative z-10 grid h-6 w-6 place-items-center rounded-full border text-[8px] ${done ? "border-[var(--accent)] bg-[var(--accent)] text-white" : current ? "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"}`}>
            {done ? <Check className="h-3 w-3" /> : index + 1}
          </span>
          <b className={`mt-2 max-w-16 text-[8px] leading-tight ${current ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>{qc.sections[sectionId].title}</b>
        </button>;
      })}
    </div>
  </div>;
}

// Compact mobile control — a dropdown of stages, used instead of the full rail below a breakpoint
// (see UX-FLOW.md §4.6: "no permanent sidebar on mobile — a compact 'שלבים' control").
export function DiscoveryStagesMenu({ currentSectionId, completedSectionIds, onSelect }: {
  currentSectionId: DiscoverySectionId; completedSectionIds: readonly DiscoverySectionId[]; onSelect: (sectionId: DiscoverySectionId) => void;
}) {
  const qc = t("discoveryQuestions"), s = t("discoveryShell");
  return <label className="field sm:hidden">
    <span>{s.stagesMenuLabel}</span>
    <select className="input" value={currentSectionId} onChange={event => onSelect(event.target.value as DiscoverySectionId)}>
      {discoverySectionOrder.map((sectionId, index) => <option value={sectionId} key={sectionId}>
        {index + 1}. {qc.sections[sectionId].title} {completedSectionIds.includes(sectionId) ? "✓" : ""}
      </option>)}
    </select>
  </label>;
}
