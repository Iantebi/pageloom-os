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
import {ReportsOverview} from "./reports-overview";
import {OperationalRecords} from "./operational-records";
import {NotificationInbox} from "./notification-inbox";
import {AgentGovernance} from "./agent-governance";
import {SupportCenter} from "./support-center";
import {TeamAccess} from "./team-access";
export function RoleScopedExtras(){const{membership}=useOrganization();const pathname=usePathname();if(!membership)return null;if(membership.role==="client")return pathname==="/portal"?<LegalCenter/>:null;return <>{pathname==="/dashboard"&&<><TeamAccess/><EnterpriseOverview/><BusinessIntelligenceOverview/><NotificationInbox/><OperationalRecords/><FleetOverview/><ReportsOverview/></>}{pathname==="/portal"&&<LegalCenter/>}{pathname==="/agents"&&<><AgentGovernance/><ManualAiQueue/></>}{pathname==="/crm"&&<SupportCenter/>}<ClientManagementWidgets/><OperationsHealthCard/><CustomerPortalAccess/></>}
