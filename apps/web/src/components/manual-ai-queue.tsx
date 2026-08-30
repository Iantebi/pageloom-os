"use client";
import {useMemo,useState} from "react";
import {Bot,CheckCircle2,Clipboard,Send} from "lucide-react";
import type {Task} from "@pageloom/core";
import {api} from "@/lib/api";
import {useLiveCollection} from "@/lib/live-data";
import {useOrganization} from "@/lib/organization";
import {Button,Card,CardHeader,Empty,Status} from "./product-ui";
import {t} from "@/lib/i18n";

type ProviderLabel="chatgpt"|"google-ai-studio"|"other";
const emptyOutput=`{
  "summary": "",
  "message": "",
  "workflowOutcome": {"status": "passed", "evidence": [""], "reason": ""},
  "deliverables": [],
  "decisions": [],
  "risks": [],
  "delegatedTasks": [],
  "actionRequests": []
}`;

export function ManualAiQueue(){const{organizationId}=useOrganization();const tasks=useLiveCollection<Task>(organizationId?`organizations/${organizationId}/tasks`:undefined,"updatedAt");const queue=useMemo(()=>tasks.data.filter(task=>task.status==="awaiting_manual_ai"&&task.manualAi).reverse(),[tasks.data]);const[selectedId,setSelectedId]=useState("");const selected=queue.find(task=>task.id===(selectedId||queue[0]?.id));const s=t("manualAiQueue");const agentNames=t("agentsPage").agentNames;const agentName=(id:string)=>agentNames[id]??id;return <Card><CardHeader icon={Bot} title={s.title} subtitle={s.subtitle} action={selected?<Status value="awaiting_manual_ai" label={s.awaitingManualAi}/>:undefined}/>{!selected?<Empty title={s.emptyTitle} description={s.emptyDescription}/>:<div className="grid gap-5 xl:grid-cols-[260px_1fr]" dir={selected.locale==="he"?"rtl":"ltr"}><nav className="space-y-2">{queue.map(task=><button key={task.id} onClick={()=>setSelectedId(task.id)} className={`w-full rounded-xl border p-3 text-start ${task.id===selected.id?"border-[#7357ff] bg-[#f4f1ff]":"border-[var(--border)]"}`}><b className="block text-[10px] capitalize">{task.context.workflowStage?s.stageLabel(String(task.context.workflowStage)):agentName(task.agentId)}</b><span className="mt-1 block text-[9px] text-[var(--muted)]">{agentName(task.agentId)}</span></button>)}</nav><ManualTask task={selected} organizationId={organizationId}/></div>}</Card>}

function ManualTask({task,organizationId}:{task:Task;organizationId:string}){const[providerLabel,setProviderLabel]=useState<ProviderLabel>("chatgpt");const[output,setOutput]=useState(emptyOutput);const[busy,setBusy]=useState(false);const[message,setMessage]=useState("");const prepared=task.manualAi!;const s=t("manualAiQueue");async function copy(){await navigator.clipboard.writeText(`${prepared.systemPrompt}\n\n${prepared.prompt}`);setMessage(s.promptCopied)}async function submit(){setBusy(true);setMessage("");try{const parsed=JSON.parse(output);await api(`/tasks/${task.id}/manual-output`,{method:"POST",body:JSON.stringify({organizationId,providerLabel,output:parsed})});setMessage(s.outputAccepted)}catch(error){setMessage(error instanceof Error?error.message:s.outputRejected)}finally{setBusy(false)}}return <div className="min-w-0 space-y-4"><div><p className="eyebrow">{s.preparedTask}</p><h3 className="mt-2 text-base font-semibold">{task.objective}</h3>{prepared.requiredDeliverables.length>0&&<p className="mt-2 text-[10px] text-[var(--muted)]">{s.requiredDeliverables(prepared.requiredDeliverables.join(", "))}</p>}</div><details className="rounded-xl border border-[var(--border)] p-4"><summary className="cursor-pointer text-[10px] font-semibold">{s.systemInstructions}</summary><pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap text-[9px] leading-5 text-[var(--muted)]">{prepared.systemPrompt}</pre></details><label className="field"><span>{s.completePrompt}</span><textarea className="input min-h-64 font-mono text-[9px] leading-5" readOnly value={prepared.prompt}/></label><Button variant="secondary" onClick={copy}><Clipboard className="h-3.5 w-3.5"/>{s.copyPrompt}</Button><div className="grid gap-3 sm:grid-cols-[220px_1fr]"><label className="field"><span>{s.generationTool}</span><select className="input" value={providerLabel} onChange={event=>setProviderLabel(event.target.value as ProviderLabel)}><option value="chatgpt">ChatGPT</option><option value="google-ai-studio">Google AI Studio</option><option value="other">{s.otherOption}</option></select></label><label className="field"><span>{s.generatedOutput}</span><textarea className="input min-h-72 font-mono text-[9px] leading-5" value={output} onChange={event=>setOutput(event.target.value)}/></label></div><Button disabled={busy} onClick={submit}><Send className="h-3.5 w-3.5"/>{busy?s.validating:s.validateAndContinue}</Button>{message&&<p className="flex items-center gap-2 rounded-xl bg-[#f4f1ff] p-3 text-[10px] text-[#58429e]"><CheckCircle2 className="h-3.5 w-3.5"/>{message}</p>}</div>}
