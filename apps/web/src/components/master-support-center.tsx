"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Headphones, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button, Card, CardHeader, Empty, Status, dateTime } from "./product-ui";
type Ticket={id:string;organizationId:string;organizationName:string;customerId:string;projectId?:string;subject:string;description:string;category?:string;priority:string;status:string;assignedTo?:string;resolution?:string;updatedAt:string};
export function MasterSupportCenter(){
  const s=t("masterSupportCenter");
  const[items,setItems]=useState<Ticket[]>([]),[status,setStatus]=useState("open"),[priority,setPriority]=useState("all"),[busy,setBusy]=useState(""),[error,setError]=useState("");
  const load=useCallback(async()=>{try{setItems(await api<Ticket[]>("/platform/support-tickets"));setError("")}catch(failure){setError(failure instanceof Error?failure.message:s.loadErrorFallback)}},[s.loadErrorFallback]);
  useEffect(()=>{let active=true;void api<Ticket[]>("/platform/support-tickets").then(result=>{if(active)setItems(result)}).catch(failure=>{if(active)setError(failure instanceof Error?failure.message:s.loadErrorFallback)});return()=>{active=false}},[s.loadErrorFallback]);
  const filtered=useMemo(()=>items.filter(item=>(status==="all"||item.status===status)&&(priority==="all"||item.priority===priority)),[items,status,priority]);
  async function update(ticket:Ticket,next:string){
    const resolution=["resolved","closed"].includes(next)?window.prompt(s.resolutionPrompt)??"":undefined;
    if(["resolved","closed"].includes(next)&&(resolution?.trim().length??0)<3)return;
    const internalNote=window.prompt(s.internalNotePrompt)||undefined,assignedTo=window.prompt(s.assignPrompt,ticket.assignedTo??"")??undefined;
    setBusy(ticket.id);
    try{await api(`/support-tickets/${ticket.id}`,{method:"PATCH",body:JSON.stringify({organizationId:ticket.organizationId,status:next,resolution,priority:ticket.priority,assignedTo,internalNote})});await load()}
    catch(failure){setError(failure instanceof Error?failure.message:s.updateErrorFallback)}finally{setBusy("")}
  }
  const statusValues=["all","open","in_progress","waiting_customer","resolved","closed"]as const;
  const priorityValues=["all","critical","high","normal","low"]as const;
  return <Card><CardHeader icon={Headphones} title={s.title} subtitle={s.subtitle} action={<button className="top-icon" onClick={()=>void load()} aria-label={s.refreshAria}><RefreshCw className="h-4 w-4"/></button>}/><div className="mb-4 grid gap-3 sm:grid-cols-2"><label className="field"><span>{s.statusFieldLabel}</span><select className="input" value={status} onChange={event=>setStatus(event.target.value)}>{statusValues.map(value=><option key={value} value={value}>{s.statusOptions[value]}</option>)}</select></label><label className="field"><span>{s.priorityFieldLabel}</span><select className="input" value={priority} onChange={event=>setPriority(event.target.value)}>{priorityValues.map(value=><option key={value} value={value}>{s.priorityOptions[value]}</option>)}</select></label></div>{filtered.length?<div className="space-y-3">{filtered.map(ticket=><article className="rounded-xl border border-[var(--border)] p-4" key={`${ticket.organizationId}-${ticket.id}`}><div className="flex flex-wrap items-start justify-between gap-3"><span><b className="block text-xs">{ticket.subject}</b><small className="mt-1 block text-[9px] text-[var(--muted)]">{ticket.organizationName} · {ticket.category??s.categoryFallback} · {s.priorityOptions[ticket.priority as keyof typeof s.priorityOptions]??ticket.priority} · {s.updatedPrefix} {dateTime(ticket.updatedAt)}</small></span><Status value={ticket.status}/></div><p className="mt-3 text-[10px] leading-5 text-[var(--muted)]">{ticket.description}</p>{ticket.resolution&&<p className="mt-2 rounded-lg bg-green-50 p-2 text-[10px] text-green-800">{ticket.resolution}</p>}<div className="mt-3 flex flex-wrap gap-2">{["in_progress","waiting_customer","resolved","closed"].filter(value=>value!==ticket.status).map(value=><Button variant="secondary" disabled={busy===ticket.id} onClick={()=>void update(ticket,value)} key={value}>{s.statusOptions[value as keyof typeof s.statusOptions]}</Button>)}</div></article>)}</div>:<Empty title={s.emptyTitle} description={error||s.emptyDescription}/>}</Card>;
}
