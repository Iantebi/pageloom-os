"use client";
import {createContext,useContext,useEffect,useMemo,useState} from "react";
import {api} from "./api";import {useAuth} from "./auth";
export type Membership={id:string;name?:string;role:"owner"|"admin"|"operator"|"member"|"client";customerId?:string};
type Value={organizationId:string;organizations:Membership[];membership?:Membership;setOrganizationId:(id:string)=>void;loading:boolean};
const Context=createContext<Value|null>(null);
export function OrganizationProvider({children}:{children:React.ReactNode}){const{user}=useAuth();const[organizations,setOrganizations]=useState<Membership[]>([]);const[organizationId,setOrganizationId]=useState("");const[loading,setLoading]=useState(true);useEffect(()=>{if(!user)return;let cancelled=false;const load=async()=>{for(let attempt=0;attempt<2;attempt++){try{const data=await api<{organizations:Membership[]}>("/me");if(!cancelled){setOrganizations(data.organizations);setOrganizationId(current=>current||data.organizations[0]?.id||"")}return}catch(error){if(attempt===1)console.error(error)}}};void load().finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[user]);const value=useMemo(()=>({organizationId,organizations,membership:organizations.find(item=>item.id===organizationId),setOrganizationId,loading}),[organizationId,organizations,loading]);return <Context.Provider value={value}>{children}</Context.Provider>}
export function useOrganization(){const value=useContext(Context);if(!value)throw new Error("OrganizationProvider is missing");return value}
