"use client";
import { Sparkles } from "lucide-react";
import { type Project } from "@pageloom/core";
import { Button, Card } from "./product-ui";
import { customerJourneyBucket } from "@/lib/i18n/dictionaries/customerJourney";
import { t } from "@/lib/i18n";

// The Welcome experience (mission section 2): shown once, right after payment is confirmed, until
// the customer has submitted their Website Brief. Not a persistent timeline step — see
// customer-journey-timeline.tsx for the ongoing status view this panel hands off to.
export function WelcomePanel({ project }: { project: Project }) {
  const s = t("customerJourney");
  if (!project.workflowStage) return null;
  const bucket = customerJourneyBucket(project.workflowStage, project.customerApprovedAt);
  if (bucket !== "payment_received" && bucket !== "website_brief") return null;
  return <Card className="lg:col-span-2">
    <div className="flex flex-wrap items-start gap-4">
      <span className="icon-box"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
      <div className="flex-1">
        <h2 className="text-lg font-semibold">{s.welcomeTitle}</h2>
        <p className="mt-2 text-xs leading-6 text-[var(--muted)]">{s.welcomeBody}</p>
        {bucket === "website_brief" && <Button className="mt-4" onClick={() => document.getElementById("website-brief")?.scrollIntoView({ behavior: "smooth" })}>{s.welcomeCta}</Button>}
      </div>
    </div>
  </Card>;
}
