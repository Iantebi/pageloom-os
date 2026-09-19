"use client";
import { useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useOrganization } from "@/lib/organization";
import { Button, Card, PageHeader } from "@/components/product-ui";
import { t } from "@/lib/i18n";

// Standalone "New Client" onboarding (2026-09-20) — deliberately independent of the CRM (/crm,
// which requires a lead and a closed-deal ceremony) and of Backend Master. See
// functions/src/client-onboarding-api.ts and docs/client-playbook/02-create-client.md. The Owner
// never sees or copies an id: the only output is a clean, opaque /d/{token} Discovery link.
type CreatedClient = { customerId: string; projectId: string; token: string; businessName: string; contactName: string };

export default function NewClientPage() {
  const { organizationId } = useOrganization();
  const s = t("newClient");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedClient>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const businessName = String(form.get("businessName") ?? "");
    const contactName = String(form.get("contactName") ?? "");
    try {
      const result = await api<{ customerId: string; projectId: string; token: string }>("/clients/new", {
        method: "POST",
        body: JSON.stringify({
          organizationId, businessName, contactName,
          email: form.get("email"), phone: form.get("phone"),
          notes: form.get("notes") || undefined,
        }),
      });
      setCreated({ ...result, businessName, contactName });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : s.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  if (created) return <CreatedView created={created} onCreateAnother={() => setCreated(undefined)} />;

  return <div className="space-y-6">
    <PageHeader eyebrow={s.eyebrow} title={s.title} description={s.description} />
    <Card className="max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        <label className="field"><span>{s.businessNameLabel} *</span><input required name="businessName" className="input" maxLength={200} /></label>
        <label className="field"><span>{s.contactNameLabel} *</span><input required name="contactName" className="input" maxLength={200} /></label>
        <label className="field"><span>{s.emailLabel} *</span><input required type="email" name="email" className="input" /></label>
        <label className="field"><span>{s.phoneLabel} *</span><input required type="tel" name="phone" className="input" /></label>
        <label className="field"><span>{s.notesLabel}</span><textarea name="notes" className="input min-h-24" placeholder={s.notesPlaceholder} maxLength={5000} /></label>
        {error && <p className="rounded-lg bg-[var(--danger-bg)] p-3 text-xs text-[var(--danger-text)]" role="alert">{error}</p>}
        <Button type="submit" disabled={busy}><UserPlus className="h-4 w-4" />{busy ? s.submitting : s.submit}</Button>
      </form>
    </Card>
  </div>;
}

function CreatedView({ created, onCreateAnother }: { created: CreatedClient; onCreateAnother: () => void }) {
  const s = t("newClient");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/d/${created.token}` : `/d/${created.token}`;

  async function copy(text: string, setCopied: (value: boolean) => void) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return <div className="space-y-6">
    <PageHeader eyebrow={t("newClient").eyebrow} title={s.successTitle} description={s.successBody(created.businessName)} />
    <Card className="max-w-xl">
      <label className="field"><span>{s.discoveryLinkLabel}</span><input readOnly className="input" value={link} onFocus={event => event.currentTarget.select()} /></label>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void copy(link, setCopiedLink)}>{copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copiedLink ? s.linkCopied : s.copyLink}</Button>
        <a className="button button-secondary" href={link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />{s.openDiscovery}</a>
        <Button variant="secondary" onClick={() => void copy(s.whatsappMessage(created.businessName, created.contactName, link), setCopiedWhatsApp)}>{copiedWhatsApp ? <Check className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}{copiedWhatsApp ? s.whatsappCopied : s.copyWhatsApp}</Button>
      </div>
      <Button className="mt-6" variant="secondary" onClick={onCreateAnother}>{s.createAnother}</Button>
    </Card>
  </div>;
}
