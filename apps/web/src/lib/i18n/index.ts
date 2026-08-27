import { currentLocale } from "./locale";
import { common, statusLabels } from "./dictionaries/common";
import { nav } from "./dictionaries/nav";
import { signIn } from "./dictionaries/signIn";
import { authErrors } from "./dictionaries/authErrors";
import { apiErrors } from "./dictionaries/apiErrors";
import { portal } from "./dictionaries/portal";
import { portalSupport } from "./dictionaries/portalSupport";
import { portalQuestionnaire } from "./dictionaries/portalQuestionnaire";
import { customerPortalAccess } from "./dictionaries/customerPortalAccess";
import { portalAccessCenter } from "./dictionaries/portalAccessCenter";
import { portalUserManager } from "./dictionaries/portalUserManager";
import { supportCenter } from "./dictionaries/supportCenter";
import { notificationInbox } from "./dictionaries/notificationInbox";
import { teamAccess } from "./dictionaries/teamAccess";
import { documentCenter } from "./dictionaries/documentCenter";
import { legalCenter } from "./dictionaries/legalCenter";
import { closingWorkspace } from "./dictionaries/closingWorkspace";
import { contentApprovalCenter } from "./dictionaries/contentApprovalCenter";
import { masterControlCenter } from "./dictionaries/masterControlCenter";
import { masterSupportCenter } from "./dictionaries/masterSupportCenter";
import { masterContentPage } from "./dictionaries/masterContentPage";
import { websiteContentWorkspace, websiteContentPreview } from "./dictionaries/websiteContent";
import { masterCustomerPage } from "./dictionaries/masterCustomerPage";
import { dashboard } from "./dictionaries/dashboard";
import { sales } from "./dictionaries/sales";
import { projects } from "./dictionaries/projects";
import { projectsView } from "./dictionaries/projectsView";
import { crm } from "./dictionaries/crm";
import { builder } from "./dictionaries/builder";
import { clientManagementWidgets } from "./dictionaries/clientManagementWidgets";
import { agentsPage } from "./dictionaries/agentsPage";
import { agentGovernance } from "./dictionaries/agentGovernance";
import { manualAiQueue } from "./dictionaries/manualAiQueue";
import { operationsOverview } from "./dictionaries/operationsOverview";
import { operationsHealthCard } from "./dictionaries/operationsHealthCard";
import { operationalRecords } from "./dictionaries/operationalRecords";
import { reportsOverview } from "./dictionaries/reportsOverview";
import { businessIntelligenceOverview } from "./dictionaries/businessIntelligenceOverview";
import { enterpriseOverview } from "./dictionaries/enterpriseOverview";
import { fleetOverview } from "./dictionaries/fleetOverview";
import { workflowTimeline } from "./dictionaries/workflowTimeline";

const dictionaries = {
  common,
  statusLabels,
  nav,
  signIn,
  authErrors,
  apiErrors,
  portal,
  portalSupport,
  portalQuestionnaire,
  customerPortalAccess,
  portalAccessCenter,
  portalUserManager,
  supportCenter,
  notificationInbox,
  teamAccess,
  documentCenter,
  legalCenter,
  closingWorkspace,
  contentApprovalCenter,
  masterControlCenter,
  masterSupportCenter,
  masterContentPage,
  websiteContentWorkspace,
  websiteContentPreview,
  masterCustomerPage,
  dashboard,
  sales,
  projects,
  projectsView,
  crm,
  builder,
  clientManagementWidgets,
  agentsPage,
  agentGovernance,
  manualAiQueue,
  operationsOverview,
  operationsHealthCard,
  operationalRecords,
  reportsOverview,
  businessIntelligenceOverview,
  enterpriseOverview,
  fleetOverview,
  workflowTimeline,
} as const;

type Dictionaries = typeof dictionaries;

// t("nav") -> the resolved Hebrew (or, later, English) strings for that namespace.
// Every dictionary carries both `he` and `en` today so a future language switch
// only has to change currentLocale() — no component or string goes missing.
export function t<K extends keyof Dictionaries>(namespace: K): Dictionaries[K]["he"] {
  return dictionaries[namespace][currentLocale()] as Dictionaries[K]["he"];
}

export { currentLocale, DEFAULT_LOCALE, isRtl } from "./locale";
export type { Locale } from "./locale";
export { money, dateTime, dateOnly, number } from "./format";
