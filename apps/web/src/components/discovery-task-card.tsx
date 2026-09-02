"use client";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useDiscovery } from "@/lib/discovery";
import { Button, Card } from "./product-ui";
import { t } from "@/lib/i18n";

// The dashboard/portal entry point into Business Discovery (mission's exact task-card example:
// "אנחנו צריכים להכיר את העסק שלכם" / "התחילו את אפיון העסק"). Reuses the Card primitive and the
// existing "premium, spacious, not overloaded" dashboard visual language — no new card component.
export function DiscoveryTaskCard({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const { state, loading } = useDiscovery(organizationId, projectId);
  const s = t("discoveryShell");
  if (loading && !state) return null;
  // No discoveryProgress doc means this project never went through the Business Discovery trigger
  // (e.g. an in-flight project still on the legacy Website Brief) — nothing to show here.
  if (!loading && !state?.progress) return null;
  const progress = state?.progress;
  const status = progress?.status ?? "not_started";
  const href = `/discovery?projectId=${projectId}`;

  if (status === "submitted" || status === "reviewed") {
    return <Card className="lg:col-span-2">
      <div className="flex items-center gap-3">
        <span className="icon-box"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
        <p className="text-sm font-semibold">{s.taskCardSubmitted}</p>
      </div>
    </Card>;
  }

  const reopened = status === "reopened";
  return <Card className="lg:col-span-2">
    <div className="flex flex-wrap items-start gap-4">
      <span className="icon-box"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold">{reopened ? s.needsMoreInfoTitle : s.taskCardTitle}</h2>
        <p className="mt-2 text-xs leading-6 text-[var(--muted)]">{reopened ? s.taskCardReopened : s.taskCardBody}</p>
        {progress && progress.completedSectionIds.length > 0 && status === "in_progress" && <p className="mt-2 text-[10px] text-[var(--muted)]">{s.taskCardProgress(progress.completedSectionIds.length)}</p>}
        <Link href={href}><Button className="mt-4">{reopened ? s.taskCardReopenedCta : status === "in_progress" ? s.taskCardContinueCta : s.taskCardCta}</Button></Link>
      </div>
    </div>
  </Card>;
}
