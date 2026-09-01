"use client";
import { Check } from "lucide-react";
import { type Project } from "@pageloom/core";
import { Card } from "./product-ui";
import { customerJourneyBucketIds, customerJourneyBucket } from "@/lib/i18n/dictionaries/customerJourney";
import { t } from "@/lib/i18n";

// The customer-facing "what is happening with my website?" timeline (see docs/customer-journey/).
// Deliberately separate from <WorkflowTimeline> (workflow-timeline.tsx), which shows staff the raw
// 22-stage internal pipeline — this groups those into the 10 plain-language buckets a customer
// actually needs, each with what PageLoom is doing, whether the customer needs to act, and what's next.
export function CustomerJourneyTimeline({ project }: { project: Project }) {
  const s = t("customerJourney");
  const stage = project.workflowStage;
  if (!stage) return null;
  const currentBucket = customerJourneyBucket(stage, project.customerApprovedAt);
  const position = customerJourneyBucketIds.indexOf(currentBucket);
  const copy = s.buckets[currentBucket];
  return <Card>
    <span className="eyebrow">{s.eyebrow}</span>
    <h2 className="mt-2 text-lg font-semibold">{copy.label}</h2>
    <div className="mt-5 grid gap-2 sm:grid-cols-3">
      <div className="rounded-xl border border-[var(--border)] p-3"><p className="text-[10px] leading-5 text-[var(--text)]">{copy.whatWereDoing}</p></div>
      <div className={`rounded-xl border p-3 ${copy.needsAction ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"}`}><p className={`text-[10px] leading-5 ${copy.needsAction ? "text-[var(--accent-on-soft)] font-semibold" : "text-[var(--text)]"}`}>{copy.actionRequired}</p></div>
      <div className="rounded-xl border border-[var(--border)] p-3"><p className="text-[10px] leading-5 text-[var(--text)]">{copy.nextStep}</p></div>
    </div>
    <div className="mt-6 overflow-x-auto pb-2">
      <div className="flex min-w-[820px] items-start">
        {customerJourneyBucketIds.map((bucket, index) => <div className="relative flex min-w-16 flex-1 flex-col items-center text-center" key={bucket}>
          {index > 0 && <i className={`absolute end-1/2 top-3 h-px w-full ${index <= position ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />}
          <span className={`relative z-10 grid h-6 w-6 place-items-center rounded-full border text-[8px] ${index < position ? "border-[var(--accent)] bg-[var(--accent)] text-white" : index === position ? "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"}`}>
            {index < position ? <Check className="h-3 w-3" /> : index + 1}
          </span>
          <b className={`mt-2 max-w-16 text-[8px] ${index === position ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>{s.buckets[bucket].label}</b>
        </div>)}
      </div>
    </div>
  </Card>;
}
