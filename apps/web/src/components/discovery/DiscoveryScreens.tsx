"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, PartyPopper } from "lucide-react";
import { discoverySectionOrder, discoverySection, missingRequiredDiscoveryFields, type DiscoverySectionId, type DiscoveryResponses } from "@pageloom/core";
import { submitDiscovery } from "@/lib/discovery";
import { Button, Card } from "@/components/product-ui";
import { t } from "@/lib/i18n";

// Review, completion, and shell chrome for the Business Discovery flow — split out of
// app/discovery/page.tsx (a Next.js page.tsx file may only export `default` plus a small fixed
// set of route-config names; any other named export fails the App Router's typed-routes check).

export function ReviewScreen({ organizationId, projectId, state, onEdit, onBack, onSubmitted }: {
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

export function CompletionScreen() {
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

export function DiscoveryShell({ children }: { children: React.ReactNode }) {
  const s = t("discoveryShell");
  return <div className="mx-auto max-w-3xl px-4 py-8">
    <header className="mb-8 flex items-center justify-between">
      <Link href="/portal" className="flex items-center gap-2.5 text-sm font-semibold"><span className="logo-mark">P</span><span>{s.brandName}</span></Link>
      <Link href="/portal" className="text-xs text-[var(--muted)]">{s.backToProjectCenter}</Link>
    </header>
    {children}
  </div>;
}
