"use client";
import {useMemo,useState} from "react";
import {Bot,CheckCircle2,Clipboard,Send} from "lucide-react";
import type {Task} from "@pageloom/core";
import {api} from "@/lib/api";
import {useLiveCollection} from "@/lib/live-data";
import {useOrganization} from "@/lib/organization";
import {Button,Card,CardHeader,Empty,Status} from "./product-ui";

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

export function ManualAiQueue(){const{organizationId}=useOrganization();const tasks=useLiveCollection<Task>(organizationId?`organizations/${organizationId}/tasks`:undefined,"updatedAt");const queue=useMemo(()=>tasks.data.filter(task=>task.status==="awaiting_manual_ai"&&task.manualAi).reverse(),[tasks.data]);const[selectedId,setSelectedId]=useState("");const selected=queue.find(task=>task.id===(selectedId||queue[0]?.id));return <Card><CardHeader icon={Bot} title="Manual AI task queue" subtitle="Automatic inference is disabled. Copy a prepared task into ChatGPT or Google AI Studio, then submit its structured output." action={selected?<Status value="awaiting_manual_ai"/>:undefined}/>{!selected?<Empty title="AI queue is clear" description="Workflow tasks that need manual generation will appear here with verified context and an exact output contract."/>:<div className="grid gap-5 xl:grid-cols-[260px_1fr]" dir={selected.locale==="he"?"rtl":"ltr"}><nav className="space-y-2">{queue.map(task=><button key={task.id} onClick={()=>setSelectedId(task.id)} className={`w-full rounded-xl border p-3 text-start ${task.id===selected.id?"border-[#7357ff] bg-[#f4f1ff]":"border-[var(--border)]"}`}><b className="block text-[10px] capitalize">{String(task.context.workflowStage??task.agentId).replaceAll("_"," ")}</b><span className="mt-1 block text-[9px] text-[var(--muted)]">{task.agentId}</span></button>)}</nav><ManualTask task={selected} organizationId={organizationId}/></div>}</Card>}

function ManualTask({task,organizationId}:{task:Task;organizationId:string}){const[providerLabel,setProviderLabel]=useState<ProviderLabel>("chatgpt");const[output,setOutput]=useState(emptyOutput);const[busy,setBusy]=useState(false);const[message,setMessage]=useState("");const prepared=task.manualAi!;async function copy(){await navigator.clipboard.writeText(`${prepared.systemPrompt}\n\n${prepared.prompt}`);setMessage("Prompt copied.")}async function submit(){setBusy(true);setMessage("");try{const parsed=JSON.parse(output);await api(`/tasks/${task.id}/manual-output`,{method:"POST",body:JSON.stringify({organizationId,providerLabel,output:parsed})});setMessage("Output accepted. The workflow is continuing.")}catch(error){setMessage(error instanceof Error?error.message:"Output could not be accepted.")}finally{setBusy(false)}}return <div className="min-w-0 space-y-4"><div><p className="eyebrow">PREPARED TASK</p><h3 className="mt-2 text-base font-semibold">{task.objective}</h3>{prepared.requiredDeliverables.length>0&&<p className="mt-2 text-[10px] text-[var(--muted)]">Required deliverables: {prepared.requiredDeliverables.join(", ")}</p>}</div><details className="rounded-xl border border-[var(--border)] p-4"><summary className="cursor-pointer text-[10px] font-semibold">System instructions</summary><pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap text-[9px] leading-5 text-[var(--muted)]">{prepared.systemPrompt}</pre></details><label className="field"><span>Complete prompt</span><textarea className="input min-h-64 font-mono text-[9px] leading-5" readOnly value={prepared.prompt}/></label><Button variant="secondary" onClick={copy}><Clipboard className="h-3.5 w-3.5"/>Copy complete prompt</Button><div className="grid gap-3 sm:grid-cols-[220px_1fr]"><label className="field"><span>Generation tool</span><select className="input" value={providerLabel} onChange={event=>setProviderLabel(event.target.value as ProviderLabel)}><option value="chatgpt">ChatGPT</option><option value="google-ai-studio">Google AI Studio</option><option value="other">Other</option></select></label><label className="field"><span>Generated JSON output</span><textarea className="input min-h-72 font-mono text-[9px] leading-5" value={output} onChange={event=>setOutput(event.target.value)}/></label></div><Button disabled={busy} onClick={submit}><Send className="h-3.5 w-3.5"/>{busy?"Validating…":"Validate and continue workflow"}</Button>{message&&<p className="flex items-center gap-2 rounded-xl bg-[#f4f1ff] p-3 text-[10px] text-[#58429e]"><CheckCircle2 className="h-3.5 w-3.5"/>{message}</p>}</div>}
