"use client";
import{MasterControlCenter}from"@/components/master-control-center";
import{ContentApprovalCenter}from"@/components/content-approval-center";
import{PortalAccessCenter}from"@/components/portal-access-center";
import{MasterSupportCenter}from"@/components/master-support-center";
import{useOrganization}from"@/lib/organization";
import{t}from"@/lib/i18n";
import{Card,Empty}from"@/components/product-ui";
export default function MasterPage(){const{membership}=useOrganization(),c=t("common");if(!membership||!["owner","admin"].includes(membership.role))return <Card><Empty title={c.adminRequiredTitle} description={c.adminRequiredDescription}/></Card>;return <div className="space-y-6"><MasterControlCenter/><ContentApprovalCenter/><PortalAccessCenter/><MasterSupportCenter/></div>}
