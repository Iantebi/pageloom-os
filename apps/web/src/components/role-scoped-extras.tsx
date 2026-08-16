"use client";
import {usePathname} from "next/navigation";
import {useOrganization} from "@/lib/organization";
import {ClientManagementWidgets} from "./client-management-widgets";
import {CustomerPortalAccess} from "./customer-portal-access";
import {OperationsHealthCard} from "./operations-health-card";
import {ManualAiQueue} from "./manual-ai-queue";
import {EnterpriseOverview} from "./enterprise-overview";
import {LegalCenter} from "./legal-center";
import {BusinessIntelligenceOverview} from "./business-intelligence-overview";
import {FleetOverview} from "./fleet-overview";
export function RoleScopedExtras(){const{membership}=useOrganization();const pathname=usePathname();if(!membership)return null;if(membership.role==="client")return pathname==="/portal"?<LegalCenter/>:null;return <>{pathname==="/dashboard"&&<><EnterpriseOverview/><BusinessIntelligenceOverview/><FleetOverview/></>}{pathname==="/portal"&&<LegalCenter/>}{pathname==="/agents"&&<ManualAiQueue/>}<ClientManagementWidgets/><OperationsHealthCard/><CustomerPortalAccess/></>}
