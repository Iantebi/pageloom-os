"use client";
import {usePathname} from "next/navigation";
import {useOrganization} from "@/lib/organization";
import {ClientManagementWidgets} from "./client-management-widgets";
import {CustomerPortalAccess} from "./customer-portal-access";
import {OperationsHealthCard} from "./operations-health-card";
import {ManualAiQueue} from "./manual-ai-queue";
export function RoleScopedExtras(){const{membership}=useOrganization();const pathname=usePathname();if(!membership||membership.role==="client")return null;return <>{pathname==="/agents"&&<ManualAiQueue/>}<ClientManagementWidgets/><OperationsHealthCard/><CustomerPortalAccess/></>}
