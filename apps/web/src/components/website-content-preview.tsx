"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Eye, History, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button, Card, CardHeader, Empty, Status, dateTime } from "./product-ui";

type Revision = { id:string; type:"field_change"|"snapshot"; fieldId?:string; reason?:string; version?:number; actorId:string; actorRole:string; createdAt:string; values?:Record<string,unknown> };
type Preview = { values:Record<string,unknown>; updatedAt?:string };

export function WebsiteContentReviewPanel({ organizationId, projectId, customerMode=false }:{ organizationId:string; projectId:string; customerMode?:boolean }) {
  const s=t("websiteContentPreview");
  const c=t("common");
  const [preview,setPreview]=useState<Preview>();
  const [history,setHistory]=useState<Revision[]>([]);
  const [selected,setSelected]=useState<Revision>();
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  async function previewRevision(revision:Revision){
    setBusy(`preview-${revision.id}`);setError("");
    try{setSelected(await api<Revision>(`/projects/${projectId}/website-content/revisions/${revision.id}?organizationId=${encodeURIComponent(organizationId)}`))}
    catch(failure){setError(failure instanceof Error?failure.message:s.revisionPreviewError)}
    finally{setBusy("")}
  }
  const load=useCallback(async()=>{
    setError("");
    try {
      setPreview(await api<Preview>(`/projects/${projectId}/website-content/preview?organizationId=${encodeURIComponent(organizationId)}`));
      if(!customerMode)setHistory(await api<Revision[]>(`/projects/${projectId}/website-content/revisions?organizationId=${encodeURIComponent(organizationId)}`));
    } catch(failure){setError(failure instanceof Error?failure.message:s.previewError)}
  },[organizationId,projectId,customerMode,s.previewError]);
  useEffect(()=>{
    let active=true;
    (async()=>{
      try {
        const nextPreview=await api<Preview>(`/projects/${projectId}/website-content/preview?organizationId=${encodeURIComponent(organizationId)}`);
        if(!active)return;
        setPreview(nextPreview);setError("");
        if(!customerMode){const nextHistory=await api<Revision[]>(`/projects/${projectId}/website-content/revisions?organizationId=${encodeURIComponent(organizationId)}`);if(active)setHistory(nextHistory)}
      } catch(failure){if(active)setError(failure instanceof Error?failure.message:s.previewError)}
    })();
    return()=>{active=false};
  },[organizationId,projectId,customerMode,s.previewError]);
  async function rollback(revision:Revision){
    if(!window.confirm(s.confirmRollback(revision.version??revision.id)))return;
    setBusy(revision.id);setError("");
    try{await api(`/projects/${projectId}/website-content/rollback`,{method:"POST",body:JSON.stringify({organizationId,revisionId:revision.id})});await load()}
    catch(failure){setError(failure instanceof Error?failure.message:s.rollbackError)}finally{setBusy("")}
  }
  return <div className="grid gap-4 lg:grid-cols-2">
    <Card className={customerMode?"lg:col-span-2":""}>
      <CardHeader icon={Eye} title={customerMode?s.previewTitleCustomer:s.previewTitleAdmin} subtitle={preview?.updatedAt?s.draftSaved(dateTime(preview.updatedAt)):s.unpublishedNotice}/>
      {preview?<WebsitePreview values={selected?.values??preview.values}/>:<Empty title={s.noDraftPreviewTitle} description={error||s.noDraftPreviewDescription}/>}
      {selected&&<div className="mt-3 flex items-center justify-between"><Status value={String(selected.version??selected.type)} label={s.revisionLabel(selected.version??selected.type)}/><Button variant="secondary" onClick={()=>setSelected(undefined)}>{s.backToCurrentDraft}</Button></div>}
    </Card>
    {!customerMode&&<Card>
      <CardHeader icon={History} title={s.historyTitle} subtitle={s.historySubtitle}/>
      {history.length?<div className="max-h-[560px] space-y-2 overflow-auto">{history.map(revision=><div className="rounded-xl border border-[var(--border)] p-3" key={revision.id}>
        <div className="flex items-start justify-between gap-2"><span><b className="block text-[10px]">{revision.type==="snapshot"?s.snapshotLabel(revision.reason??s.reasonFallback,revision.version??"—"):s.changedFieldLabel(revision.fieldId??"")}</b><small className="text-[8px] text-[var(--muted)]">{dateTime(revision.createdAt)} · {revision.actorRole} · {revision.actorId}</small></span><Status value={revision.type}/></div>
        <div className="mt-3 flex gap-2">{revision.type==="snapshot"&&<Button variant="secondary" disabled={busy===`preview-${revision.id}`} onClick={()=>void previewRevision(revision)}>{busy===`preview-${revision.id}`?c.loading:s.previewRevision}</Button>}{revision.type==="snapshot"&&<Button variant="secondary" disabled={busy===revision.id} onClick={()=>void rollback(revision)}><RotateCcw className="h-3.5 w-3.5"/>{c.rollback}</Button>}</div>
      </div>)}</div>:<Empty title={s.noRevisionsTitle} description={s.noRevisionsDescription}/>}
      {error&&<p className="notice notice-error" role="alert">{error}</p>}
    </Card>}
  </div>;
}

function WebsitePreview({values}:{values:Record<string,unknown>}){
  const s=t("websiteContentPreview");
  const heroImage=typeof values.heroImage==="string"?values.heroImage:"";
  const cta=typeof values.ctaLabel==="string"?values.ctaLabel:"";
  const services=Array.isArray(values.services)?values.services as {title:string;description:string;priceLabel?:string}[]:[];
  const gallery=Array.isArray(values.galleryImages)?values.galleryImages as string[]:[];
  const faq=Array.isArray(values.faqItems)?values.faqItems as {question:string;answer:string}[]:[];
  return <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
    <section className="relative min-h-64 bg-[#151814] p-8 text-white">{heroImage&&<Image unoptimized fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover opacity-35" src={heroImage} alt=""/>}<div className="relative max-w-xl"><p className="text-[10px] uppercase tracking-[.2em]">{s.securePreviewBadge}</p><h3 className="mt-4 text-3xl font-semibold">{String(values.heroHeading||s.heroHeadingFallback)}</h3><p className="mt-3 text-sm text-white/75">{String(values.heroSubheading||values.heroBody||"")}</p>{cta&&<span className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold text-black">{cta}</span>}</div></section>
    <section className="p-7"><h4 className="text-xl font-semibold">{String(values.aboutHeading||s.aboutHeadingFallback)}</h4><p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-[var(--muted)]">{String(values.aboutBody||"")}</p>
      {services.length>0&&<div className="mt-6 grid gap-3 sm:grid-cols-2">{services.map((service,index)=><article className="rounded-xl bg-[#f7f7f5] p-4" key={`${service.title}-${index}`}><b className="text-xs">{service.title}</b><p className="mt-2 text-[10px] leading-5 text-[var(--muted)]">{service.description}</p>{service.priceLabel&&<small>{service.priceLabel}</small>}</article>)}</div>}
      {gallery.length>0&&<div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">{gallery.map(path=><span className="relative aspect-square" key={path}><Image unoptimized fill sizes="(max-width: 640px) 50vw, 20vw" className="rounded-xl object-cover" src={path} alt=""/></span>)}</div>}
      {faq.length>0&&<div className="mt-6 space-y-2">{faq.map((item,index)=><details className="rounded-xl border p-3" key={`${item.question}-${index}`}><summary className="text-xs font-semibold">{item.question}</summary><p className="mt-2 text-[10px] text-[var(--muted)]">{item.answer}</p></details>)}</div>}
      <p className="mt-6 text-[10px] text-[var(--muted)]">{[values.phone,values.email,values.address].filter(Boolean).map(String).join(" · ")}</p>
    </section>
  </div>;
}
