"use client";
import { Plus, X } from "lucide-react";
import type { DiscoveryQuestion, DiscoverySectionId } from "@pageloom/core";
import { firebaseAuth } from "@/lib/firebase";
import { useFileUpload } from "@/lib/hooks/useFileUpload";
import { t } from "@/lib/i18n";

type FileRecord = { path: string; fileName: string; uploadedAt: string; sizeBytes: number; source: "customer" | "ai_generated" };
type ServiceEntry = { name: string; forWhom?: string; problem?: string; outcome?: string; priceLabel?: string; promote: boolean };
type TestimonialEntry = { text: string; author?: string };
type AddressValue = { line1: string; city: string; serviceAreas?: string[] };

export function DiscoveryQuestionField({ question, value, organizationId, projectId, sectionId, onChange }: {
  question: DiscoveryQuestion; value: unknown; organizationId: string; projectId: string; sectionId: DiscoverySectionId; onChange: (value: unknown) => void;
}) {
  const qc = t("discoveryQuestions"), s = t("discoveryShell");
  const copy = (qc.questions as Record<string, { label: string; placeholder?: string }>)[question.id];

  switch (question.type) {
    case "short_text":
    case "email":
    case "phone":
    case "url":
    case "date":
      return <input
        className="input" type={question.type === "email" ? "email" : question.type === "url" ? "url" : question.type === "phone" ? "tel" : question.type === "date" ? "date" : "text"}
        value={String(value ?? "")} placeholder={copy?.placeholder} maxLength={question.maxLength ?? 300}
        onChange={event => onChange(event.target.value)} />;

    case "long_text":
      return <textarea className="input min-h-32" value={String(value ?? "")} placeholder={copy?.placeholder} maxLength={question.maxLength ?? 5000} onChange={event => onChange(event.target.value)} />;

    case "boolean":
      return <div className="flex gap-2">
        <button type="button" className={`button ${value === true ? "button-primary" : "button-secondary"}`} onClick={() => onChange(true)}>{s.yesLabel}</button>
        <button type="button" className={`button ${value === false ? "button-primary" : "button-secondary"}`} onClick={() => onChange(false)}>{s.noLabel}</button>
      </div>;

    case "select":
      return <select className="input" value={String(value ?? "")} onChange={event => onChange(event.target.value)}>
        <option value="" />
        {question.options?.map(option => <option value={option} key={option}>{qc.options[option as keyof typeof qc.options] ?? option}</option>)}
      </select>;

    case "multi_select": {
      const selected = Array.isArray(value) ? value as string[] : [];
      return <div className="grid gap-2 sm:grid-cols-2">
        {question.options?.map(option => <label className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${selected.includes(option) ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"}`} key={option}>
          <input type="checkbox" checked={selected.includes(option)} onChange={event => onChange(event.target.checked ? [...selected, option] : selected.filter(item => item !== option))} />
          {qc.options[option as keyof typeof qc.options] ?? option}
        </label>)}
      </div>;
    }

    case "color_pair": {
      const selected = Array.isArray(value) ? value as string[] : [];
      const max = question.maxItems ?? 2;
      const swatches = (qc.swatchHex ?? {}) as Record<string, string>;
      return <div className="flex flex-wrap gap-3">
        {question.options?.filter(option => option !== "custom").map(option => {
          const hex = swatches[option];
          if (!hex) return null;
          const active = selected.includes(hex);
          return <button type="button" key={option}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-[9px] ${active ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
            onClick={() => {
              if (active) return onChange(selected.filter(color => color !== hex));
              if (selected.length >= max) return onChange([...selected.slice(1), hex]);
              onChange([...selected, hex]);
            }}>
            <span className="h-8 w-8 rounded-full border border-[var(--border)]" style={{ background: hex }} />
            {qc.options[option as keyof typeof qc.options] ?? option}
          </button>;
        })}
        <label className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] p-2 text-[9px]">
          <input type="color" className="h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent p-0" onChange={event => {
            const hex = event.target.value;
            if (selected.length >= max) return onChange([...selected.slice(1), hex]);
            onChange([...selected, hex]);
          }} />
          {qc.options.custom ?? "custom"}
        </label>
      </div>;
    }

    case "address": {
      const address = (value ?? {}) as Partial<AddressValue>;
      return <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" placeholder={s.addressLine1} value={address.line1 ?? ""} onChange={event => onChange({ ...address, line1: event.target.value })} />
        <input className="input" placeholder={s.addressCity} value={address.city ?? ""} onChange={event => onChange({ ...address, city: event.target.value })} />
        <input className="input sm:col-span-2" placeholder={s.addressServiceAreas} value={(address.serviceAreas ?? []).join(", ")} onChange={event => onChange({ ...address, serviceAreas: event.target.value.split(",").map(item => item.trim()).filter(Boolean) })} />
      </div>;
    }

    case "social_links": {
      const links = Array.isArray(value) ? value as string[] : [];
      return <textarea className="input min-h-20" value={links.join("\n")} placeholder="https://instagram.com/..." onChange={event => onChange(event.target.value.split("\n").map(line => line.trim()).filter(Boolean))} />;
    }

    case "file":
      return <SingleFileField organizationId={organizationId} projectId={projectId} sectionId={sectionId} questionId={question.id} value={value as FileRecord[] | undefined} onChange={onChange} />;

    case "file_repeater":
      return <RepeaterFileField organizationId={organizationId} projectId={projectId} sectionId={sectionId} questionId={question.id} maxItems={question.maxItems ?? 10} value={value as FileRecord[] | undefined} onChange={onChange} />;

    case "service_repeater":
      return <ServiceRepeaterField value={value as ServiceEntry[] | undefined} maxItems={question.maxItems ?? 20} onChange={onChange} />;

    case "testimonial_repeater":
      return <TestimonialRepeaterField value={value as TestimonialEntry[] | undefined} maxItems={question.maxItems ?? 10} onChange={onChange} />;

    default:
      return null;
  }
}

function uploadPath(organizationId: string, projectId: string, sectionId: string, questionId: string, itemIndex: number, fileName: string) {
  const uid = firebaseAuth.currentUser?.uid ?? "unknown";
  return `organizations/${organizationId}/discovery/${projectId}/${sectionId}/${questionId}/${uid}/${itemIndex}-${crypto.randomUUID()}-${fileName}`;
}

function UploadSlot({ organizationId, projectId, sectionId, questionId, itemIndex, record, onDone, onRemove }: {
  organizationId: string; projectId: string; sectionId: string; questionId: string; itemIndex: number;
  record?: FileRecord; onDone: (record: FileRecord) => void; onRemove: () => void;
}) {
  const { state, upload } = useFileUpload();
  const s = t("discoveryShell");
  const isImage = record?.fileName ? /\.(jpe?g|png|webp)$/i.test(record.fileName) : false;

  async function handleSelect(file?: File) {
    if (!file) return;
    try {
      const result = await upload(uploadPath(organizationId, projectId, sectionId, questionId, itemIndex, file.name), file, { projectId, sectionId, fieldId: questionId });
      onDone({ path: result.path, fileName: result.fileName, uploadedAt: new Date().toISOString(), sizeBytes: result.sizeBytes, source: "customer" });
    } catch { /* surfaced via state.status === "error" below */ }
  }

  if (record && state.status !== "uploading") {
    return <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-2">
      {isImage ? <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg bg-[var(--surface-2)] text-[9px]">🖼</span> : <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--surface-2)] text-[9px]">📄</span>}
      <span className="min-w-0 flex-1 truncate text-[10px]">{record.fileName}</span>
      <button type="button" className="text-[var(--muted)]" onClick={onRemove} aria-label={s.uploadRemove}><X className="h-4 w-4" /></button>
    </div>;
  }
  return <div className="rounded-xl border border-dashed border-[var(--border)] p-3">
    <label className="button button-secondary w-full cursor-pointer justify-center">
      {state.status === "uploading" ? s.uploading(state.percent) : s.uploadFile}
      <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={state.status === "uploading"} onChange={event => void handleSelect(event.target.files?.[0])} />
    </label>
    {state.status === "uploading" && <div className="progress mt-2"><i style={{ width: `${state.percent}%` }} /></div>}
    {state.status === "error" && <p className="mt-2 text-[10px] text-[var(--danger-text)]">{state.message === "too_large" ? s.uploadTooLarge : state.message === "wrong_type" ? s.uploadWrongType : s.uploadFailed}</p>}
  </div>;
}

function SingleFileField({ organizationId, projectId, sectionId, questionId, value, onChange }: { organizationId: string; projectId: string; sectionId: DiscoverySectionId; questionId: string; value?: FileRecord[]; onChange: (value: FileRecord[]) => void }) {
  const record = value?.[0];
  return <UploadSlot organizationId={organizationId} projectId={projectId} sectionId={sectionId} questionId={questionId} itemIndex={0} record={record} onDone={next => onChange([next])} onRemove={() => onChange([])} />;
}

function RepeaterFileField({ organizationId, projectId, sectionId, questionId, maxItems, value, onChange }: { organizationId: string; projectId: string; sectionId: DiscoverySectionId; questionId: string; maxItems: number; value?: FileRecord[]; onChange: (value: FileRecord[]) => void }) {
  const items = value ?? [];
  return <div className="grid gap-2 sm:grid-cols-2">
    {items.map((record, index) => <UploadSlot key={record.path} organizationId={organizationId} projectId={projectId} sectionId={sectionId} questionId={questionId} itemIndex={index} record={record} onDone={next => onChange(items.map((item, i) => i === index ? next : item))} onRemove={() => onChange(items.filter((_item, i) => i !== index))} />)}
    {items.length < maxItems && <UploadSlot organizationId={organizationId} projectId={projectId} sectionId={sectionId} questionId={questionId} itemIndex={items.length} onDone={next => onChange([...items, next])} onRemove={() => { /* nothing to remove before upload */ }} />}
    <p className="col-span-full text-[9px] text-[var(--muted)]">{items.length}/{maxItems}</p>
  </div>;
}

function ServiceRepeaterField({ value, maxItems, onChange }: { value?: ServiceEntry[]; maxItems: number; onChange: (value: ServiceEntry[]) => void }) {
  const items = value?.length ? value : [{ name: "", promote: false }];
  const qc = t("discoveryQuestions");
  function update(index: number, patch: Partial<ServiceEntry>) { onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  return <div className="space-y-3">
    {items.map((item, index) => <div className="rounded-xl border border-[var(--border)] p-3" key={index}>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" placeholder={qc.questions["services.name"]?.label} value={item.name} onChange={event => update(index, { name: event.target.value })} />
        <input className="input" placeholder={qc.questions["services.forWhom"]?.label} value={item.forWhom ?? ""} onChange={event => update(index, { forWhom: event.target.value })} />
        <input className="input" placeholder={qc.questions["services.problem"]?.label} value={item.problem ?? ""} onChange={event => update(index, { problem: event.target.value })} />
        <input className="input" placeholder={qc.questions["services.outcome"]?.label} value={item.outcome ?? ""} onChange={event => update(index, { outcome: event.target.value })} />
        <input className="input" placeholder={qc.questions["services.priceLabel"]?.label} value={item.priceLabel ?? ""} onChange={event => update(index, { priceLabel: event.target.value })} />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={item.promote} onChange={event => update(index, { promote: event.target.checked })} />{qc.questions["services.promote"]?.label}</label>
      </div>
      {items.length > 1 && <button type="button" className="mt-2 text-[10px] text-[var(--danger-text)]" onClick={() => onChange(items.filter((_it, i) => i !== index))}>{qc.questions["services.remove"]?.label}</button>}
    </div>)}
    {items.length < maxItems && <button type="button" className="button button-secondary" onClick={() => onChange([...items, { name: "", promote: false }])}><Plus className="h-4 w-4" />{qc.questions["services.add"]?.label}</button>}
  </div>;
}

function TestimonialRepeaterField({ value, maxItems, onChange }: { value?: TestimonialEntry[]; maxItems: number; onChange: (value: TestimonialEntry[]) => void }) {
  const items = value ?? [];
  const s = t("discoveryShell");
  function update(index: number, patch: Partial<TestimonialEntry>) { onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  return <div className="space-y-3">
    {items.map((item, index) => <div className="rounded-xl border border-[var(--border)] p-3" key={index}>
      <textarea className="input min-h-16" value={item.text} onChange={event => update(index, { text: event.target.value })} />
      <input className="input mt-2" value={item.author ?? ""} onChange={event => update(index, { author: event.target.value })} />
      <button type="button" className="mt-2 text-[10px] text-[var(--danger-text)]" onClick={() => onChange(items.filter((_it, i) => i !== index))}>{s.removeItem}</button>
    </div>)}
    {items.length < maxItems && <button type="button" className="button button-secondary" onClick={() => onChange([...items, { text: "" }])}><Plus className="h-4 w-4" />{s.addItem}</button>}
  </div>;
}
