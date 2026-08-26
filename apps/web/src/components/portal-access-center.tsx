"use client";
import { useCallback, useEffect, useState } from "react";
import { UsersRound } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardHeader, Empty } from "./product-ui";
import { PortalUserManager } from "./portal-user-manager";
type Customer={id:string;organizationId:string;businessName:string;customer:string};
type Item={id:string;name?:unknown;email?:unknown;permissions?:unknown};
type Profile={projects:Item[];websites:Item[];portalUsers:Item[]};
export function PortalAccessCenter(){
  const[customers,setCustomers]=useState<Customer[]>([]),[selected,setSelected]=useState(""),[profile,setProfile]=useState<Profile>(),[error,setError]=useState("");
  const current=customers.find(item=>`${item.organizationId}:${item.id}`===selected)??customers[0];
  const currentOrg=current?.organizationId,currentCustomer=current?.id;
  const loadProfile=useCallback(async()=>{if(!currentOrg||!currentCustomer)return;try{setProfile(await api<Profile>(`/admin/customers/${currentCustomer}?organizationId=${encodeURIComponent(currentOrg)}`));setError("")}catch(failure){setError(failure instanceof Error?failure.message:"Portal access data is unavailable.")}},[currentOrg,currentCustomer]);
  useEffect(()=>{let active=true;void api<{customerInfrastructure:Customer[]}>("/platform/master").then(data=>{if(active)setCustomers(data.customerInfrastructure)}).catch(failure=>{if(active)setError(failure instanceof Error?failure.message:"Customer directory is unavailable.")});return()=>{active=false}},[]);
  useEffect(()=>{if(!currentOrg||!currentCustomer)return;let active=true;void api<Profile>(`/admin/customers/${currentCustomer}?organizationId=${encodeURIComponent(currentOrg)}`).then(data=>{if(active)setProfile(data)}).catch(failure=>{if(active)setError(failure instanceof Error?failure.message:"Portal access data is unavailable.")});return()=>{active=false}},[currentOrg,currentCustomer]);
  return <div className="space-y-4"><Card><CardHeader icon={UsersRound} title="Customer portal administration" subtitle="Invite, scope, enable, disable, reset, and audit customer access"/>{customers.length?<label className="field"><span>Customer</span><select className="input" value={current?`${current.organizationId}:${current.id}`:""} onChange={event=>{setSelected(event.target.value);setProfile(undefined)}}>{customers.map(customer=><option value={`${customer.organizationId}:${customer.id}`} key={`${customer.organizationId}:${customer.id}`}>{customer.businessName||customer.customer}</option>)}</select></label>:<Empty title="No customers available" description={error||"Customers will appear after onboarding."}/>}</Card>{current&&profile&&<PortalUserManager organizationId={current.organizationId} customerId={current.id} projects={profile.projects} websites={profile.websites} users={profile.portalUsers} onChanged={loadProfile}/>}</div>;
}
