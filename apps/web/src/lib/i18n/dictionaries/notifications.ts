// Formats structured `type` + `params` notification payloads (see packages/core/src/business-automation.ts,
// functions/src/operational-records-api.ts, functions/src/website-content-api.ts, and
// functions/src/workflow-engine.ts) into a natural sentence in the active locale — mirrors the
// changedFieldLabel(fieldId) pattern in ./websiteContent.ts: take a raw id/type, return a formatted
// string with a safe fallback for anything unrecognized. Producers keep writing English `title`/`body`
// too, so a notification whose `type` is missing or unrecognized (including every document written
// before this change) still renders correctly via that fallback — see notification-inbox.tsx and
// dashboard/page.tsx, which call `format()` and fall back to `item.title`/`item.body` when it returns
// undefined.
import { agentNamesEn, agentNamesHe } from "./agentsPage";
import { priorityLabelsEn, priorityLabelsHe } from "./operationalRecords";
import { statusLabels } from "./common";
import { dateTime, number } from "../format";

type DomainExpiryParams = { domain: string; daysRemaining: number };
type SslExpiryParams = { domain: string; daysRemaining: number };
type BackupFailureParams = { resourceId: string };
type CustomerInactivityParams = { customerName: string; daysInactive: number };
type ProjectStalledParams = { projectName: string };
type NegativeProfitabilityParams = { projectName: string; deficit: number };
type SupportTicketCreatedParams = { subject: string; priority: string };
type SupportTicketResolvedParams = { resolution: string };
type ContentSubmittedParams = { siteName: string };
type ContentChangesRequestedParams = { reason: string };
type ContentRejectedParams = { reason: string };
type ContentPublishedParams = { version: number };
type WorkflowStageChangedParams = { fromStage: string; toStage: string; isRetry: boolean; agentIds: string[]; approval: string; dueAt: string };

// Mirrors the `type` string written at each notification producer — keep in sync if a producer adds,
// renames, or removes a notification type.
export type NotificationParamsByType = {
  domain_expiry: DomainExpiryParams;
  ssl_expiry: SslExpiryParams;
  backup_failure: BackupFailureParams;
  customer_inactivity: CustomerInactivityParams;
  project_stalled: ProjectStalledParams;
  negative_profitability: NegativeProfitabilityParams;
  support_ticket_created: SupportTicketCreatedParams;
  support_ticket_resolved: SupportTicketResolvedParams;
  website_content_submitted: ContentSubmittedParams;
  website_content_changes_requested: ContentChangesRequestedParams;
  website_content_rejected: ContentRejectedParams;
  website_content_published: ContentPublishedParams;
  workflow_stage_changed: WorkflowStageChangedParams;
};
export type NotificationType = keyof NotificationParamsByType;
const notificationTypes = new Set<string>(["domain_expiry", "ssl_expiry", "backup_failure", "customer_inactivity", "project_stalled", "negative_profitability", "support_ticket_created", "support_ticket_resolved", "website_content_submitted", "website_content_changes_requested", "website_content_rejected", "website_content_published", "workflow_stage_changed"]);
function isKnownType(value: string): value is NotificationType { return notificationTypes.has(value); }

const approvalLabelsHe: Record<string, string> = { none: "ללא", ceo: "מנכ\"ל", customer: "לקוח" };
const approvalLabelsEn: Record<string, string> = { none: "None", ceo: "CEO", customer: "Customer" };

// Every param is untyped `unknown` at the wire boundary (a Firestore document), so each formatter
// coerces defensively instead of trusting the shape — a missing or malformed field degrades to an
// empty/zero value rather than throwing and breaking the whole inbox.
const str = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(str) : []);
const bool = (value: unknown) => value === true;

function stageLabel(stage: string, labels: Record<string, string>) { return labels[stage] ?? stage.replaceAll("_", " "); }
function responsibleParty(agentIds: string[], approval: string, agentNames: Record<string, string>, approvalLabels: Record<string, string>) {
  return agentIds.length ? agentIds.map(id => agentNames[id] ?? id).join(", ") : (approvalLabels[approval] ?? approval);
}

type Formatters = { [K in NotificationType]: (params: NotificationParamsByType[K]) => string };

const formattersHe: Formatters = {
  domain_expiry: params => `תוקף הדומיין ${str(params.domain)} יפוג בעוד ${num(params.daysRemaining)} ימים`,
  ssl_expiry: params => `תעודת ה-SSL של ${str(params.domain)} תפוג בעוד ${num(params.daysRemaining)} ימים`,
  backup_failure: params => `הגיבוי עבור המשאב ${str(params.resourceId)} נכשל ודורש בדיקת שחזור`,
  customer_inactivity: params => `הלקוח ${str(params.customerName)} אינו פעיל כבר ${num(params.daysInactive)} ימים`,
  project_stalled: params => `בפרויקט ${str(params.projectName)} לא נרשמה פעילות מאומתת`,
  negative_profitability: params => `הרווחיות בפרויקט ${str(params.projectName)} שלילית — גירעון של ${number(Math.abs(num(params.deficit)))}`,
  support_ticket_created: params => `התקבלה פנייתי תמיכה חדשה מלקוח (עדיפות ${priorityLabelsHe[str(params.priority)] ?? str(params.priority)}): ${str(params.subject)}`,
  support_ticket_resolved: params => `פנייתכם לתמיכה טופלה: ${str(params.resolution)}`,
  website_content_submitted: params => `תוכן האתר ${str(params.siteName)} מוכן לבדיקה`,
  website_content_changes_requested: params => `נדרשים שינויים בתוכן האתר: ${str(params.reason)}`,
  website_content_rejected: params => `תוכן האתר נדחה: ${str(params.reason)}`,
  website_content_published: params => `גרסה ${num(params.version)} של תוכן האתר פורסמה`,
  workflow_stage_changed: params => { const stage = stageLabel(str(params.toStage), statusLabels.he), responsible = responsibleParty(list(params.agentIds), str(params.approval), agentNamesHe, approvalLabelsHe); return `${bool(params.isRetry) ? `ניסיון חוזר בשלב "${stage}"` : `הפרויקט עבר לשלב "${stage}"`}. אחראים: ${responsible}. מועד סיום משוער: ${dateTime(str(params.dueAt))}.`; },
};

const formattersEn: Formatters = {
  domain_expiry: params => `Domain ${str(params.domain)} expires in ${num(params.daysRemaining)} days`,
  ssl_expiry: params => `SSL certificate for ${str(params.domain)} expires in ${num(params.daysRemaining)} days`,
  backup_failure: params => `Backup for resource ${str(params.resourceId)} failed and requires recovery review`,
  customer_inactivity: params => `Customer ${str(params.customerName)} has been inactive for ${num(params.daysInactive)} days`,
  project_stalled: params => `Project ${str(params.projectName)} has no verified activity`,
  negative_profitability: params => `Profitability on ${str(params.projectName)} is negative — a deficit of ${number(Math.abs(num(params.deficit)))}`,
  support_ticket_created: params => `New customer support request (priority ${priorityLabelsEn[str(params.priority)] ?? str(params.priority)}): ${str(params.subject)}`,
  support_ticket_resolved: params => `Your support request was resolved: ${str(params.resolution)}`,
  website_content_submitted: params => `Website content for ${str(params.siteName)} is ready for review`,
  website_content_changes_requested: params => `Changes are required on the website content: ${str(params.reason)}`,
  website_content_rejected: params => `Website content was rejected: ${str(params.reason)}`,
  website_content_published: params => `Website content version ${num(params.version)} is now published`,
  workflow_stage_changed: params => { const stage = stageLabel(str(params.toStage), statusLabels.en), responsible = responsibleParty(list(params.agentIds), str(params.approval), agentNamesEn, approvalLabelsEn); return `${bool(params.isRetry) ? `Retrying stage "${stage}"` : `Project moved to stage "${stage}"`}. Responsible: ${responsible}. Estimated completion ${dateTime(str(params.dueAt))}.`; },
};

export const notifications = {
  he: { format: (type: string | undefined, params: Record<string, unknown> | undefined): string | undefined => (type && isKnownType(type) ? formattersHe[type](params as never) : undefined) },
  en: { format: (type: string | undefined, params: Record<string, unknown> | undefined): string | undefined => (type && isKnownType(type) ? formattersEn[type](params as never) : undefined) },
} as const;
