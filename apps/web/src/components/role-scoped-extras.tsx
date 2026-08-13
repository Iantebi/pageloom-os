"use client";
import {useOrganization} from "@/lib/organization";
import {ClientManagementWidgets} from "./client-management-widgets";
import {CustomerPortalAccess} from "./customer-portal-access";
import {OperationsHealthCard} from "./operations-health-card";
export function RoleScopedExtras(){const{membership}=useOrganization();if(!membership||membership.role==="client")return null;return <><ClientManagementWidgets/><OperationsHealthCard/><CustomerPortalAccess/></>}
