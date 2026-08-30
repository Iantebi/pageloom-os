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
export function RoleScopedExtras(){const{membership}=useOrganization();const pathname=usePathname();if(!membership)return null;
  // LegalCenter reads organizations/{orgId}/legalDocuments, which firestore.rules and the API
  // both restrict to privileged staff (owner/admin/operator) — never `client`. It must never be
  // rendered for a client, even on /portal, or the resulting 403 surfaces as an unhandled error.
  if(membership.role==="client")return null;
  // OperationalRecords reads organizations/{orgId}/revenue and .../expenses directly via the client
  // SDK, and firestore.rules treats those ledgers as privileged (owner/admin/operator only — see the
  // "member is intentionally excluded" comment there); the finance-write API routes it calls
  // (/finance/:kind, /support-tickets) enforce the same privileged tier. Rendering it for `member`
  // produced a permission-denied read that looked like an empty/zero ledger instead of the real data,
  // and action buttons that always failed with a 403 — hide it for the one role that can never use it.
  const isPrivileged=["owner","admin","operator"].includes(membership.role);
  return <>{pathname==="/dashboard"&&<><TeamAccess/><EnterpriseOverview/><BusinessIntelligenceOverview/><NotificationInbox/>{isPrivileged&&<OperationalRecords/>}<FleetOverview/><ReportsOverview/></>}{pathname==="/portal"&&<LegalCenter/>}{pathname==="/agents"&&<><AgentGovernance/><ManualAiQueue/></>}{pathname==="/crm"&&<SupportCenter/>}<ClientManagementWidgets/><OperationsHealthCard/><CustomerPortalAccess/></>}
