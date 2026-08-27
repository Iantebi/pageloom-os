"use client";
import {useMemo,useState} from "react";
import {usePathname} from "next/navigation";
import {KeyRound} from "lucide-react";
import {api} from "@/lib/api";
import {useLiveCollection} from "@/lib/live-data";
import {useOrganization} from "@/lib/organization";
import {t,dateOnly} from "@/lib/i18n";
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
  const s=t("customerPortalAccess");
  if(pathname!=="/crm"||!membership||!["owner","admin"].includes(membership.role))return null;

  async function createInvitation(){
    if(!selected||!email)return;
    setBusy(true);setFeedback(null);
    try{
      const result=await api<{expiresAt:string}>(`/customers/${selected}/invitations`,{method:"POST",body:JSON.stringify({organizationId,email})});
      setFeedback({tone:"success",text:s.successMessage(dateOnly(result.expiresAt))});
      setEmail("");
    }catch(error){setFeedback({tone:"error",text:error instanceof Error?error.message:s.errorMessage})}
    finally{setBusy(false)}
  }

  return <Card className="mb-7"><CardHeader icon={KeyRound} title={s.title} subtitle={s.subtitle}/>{!customers.loading&&!customers.data.length?<Empty title={s.noCustomersTitle} description={s.noCustomersDescription}/>:<><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><label className="field"><span>{s.customerLabel}</span><select className="input" value={selected} onChange={event=>setCustomerId(event.target.value)} disabled={customers.loading||busy}>{customers.loading?<option>{s.loadingCustomers}</option>:customers.data.map(customer=><option key={customer.id} value={customer.id}>{customer.businessName}</option>)}</select></label><label className="field"><span>{s.emailLabel}</span><input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} disabled={busy} aria-describedby="portal-email-help"/><small id="portal-email-help" className="text-[10px] text-[var(--muted)]">{s.emailHelp}</small></label><Button className="self-end" disabled={busy||!selected||!email} onClick={()=>void createInvitation()} aria-busy={busy}>{busy?s.creating:s.createAccess}</Button></div>{feedback&&<p className={`notice notice-${feedback.tone}`} role={feedback.tone==="error"?"alert":"status"}>{feedback.text}</p>}</>}</Card>
}
