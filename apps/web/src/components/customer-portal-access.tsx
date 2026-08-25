"use client";
import {useMemo,useState} from "react";
import {usePathname} from "next/navigation";
import {KeyRound} from "lucide-react";
import {api} from "@/lib/api";
import {useLiveCollection} from "@/lib/live-data";
import {useOrganization} from "@/lib/organization";
import {Button,Card,CardHeader,Empty} from "./product-ui";

type Customer={id:string;businessName:string;status:string;updatedAt:string};

export function CustomerPortalAccess(){
  const pathname=usePathname();
  const {organizationId,membership}=useOrganization();
  const customers=useLiveCollection<Customer>(pathname==="/crm"&&organizationId?`organizations/${organizationId}/customers`:undefined);
  const [customerId,setCustomerId]=useState("");
  const [email,setEmail]=useState("");
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState<{tone:"success"|"error";text:string}|null>(null);
  const selected=useMemo(()=>customerId||customers.data[0]?.id||"",[customerId,customers.data]);
  if(pathname!=="/crm"||!membership||!["owner","admin"].includes(membership.role))return null;

  async function createInvitation(){
    if(!selected||!email)return;
    setBusy(true);setFeedback(null);
    try{
      const result=await api<{expiresAt:string}>(`/customers/${selected}/invitations`,{method:"POST",body:JSON.stringify({organizationId,email})});
      setFeedback({tone:"success",text:`Portal access is ready until ${new Intl.DateTimeFormat("en",{dateStyle:"medium"}).format(new Date(result.expiresAt))}. Ask the customer to sign in with the same verified Google email.`});
      setEmail("");
    }catch(error){setFeedback({tone:"error",text:error instanceof Error?error.message:"We couldn’t create portal access. Try again."})}
    finally{setBusy(false)}
  }

  return <Card className="mb-7"><CardHeader icon={KeyRound} title="Customer portal access" subtitle="Grant a verified customer email access only to its own projects and files"/>{!customers.loading&&!customers.data.length?<Empty title="No customers available" description="Add a customer before creating portal access."/>:<><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><label className="field"><span>Customer</span><select className="input" value={selected} onChange={event=>setCustomerId(event.target.value)} disabled={customers.loading||busy}>{customers.loading?<option>Loading customers…</option>:customers.data.map(customer=><option key={customer.id} value={customer.id}>{customer.businessName}</option>)}</select></label><label className="field"><span>Customer Google email</span><input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} disabled={busy} aria-describedby="portal-email-help"/><small id="portal-email-help" className="text-[10px] text-[var(--muted)]">Use the exact Google email the customer will sign in with.</small></label><Button className="self-end" disabled={busy||!selected||!email} onClick={()=>void createInvitation()} aria-busy={busy}>{busy?"Creating access…":"Create access"}</Button></div>{feedback&&<p className={`notice notice-${feedback.tone}`} role={feedback.tone==="error"?"alert":"status"}>{feedback.text}</p>}</>}</Card>
}
