import {z} from "zod";
import {agentIdSchema,localeSchema} from "./types.js";

export const leadStatusSchema=z.enum(["new","contacted","qualified","proposal","negotiation","won","lost"]);
export const customerStatusSchema=z.enum(["active","onboarding","inactive"]);
export const questionnaireFieldTypeSchema=z.enum(["short_text","long_text","email","phone","url","select","multi_select","boolean","file"]);
export const questionnaireFieldSchema=z.object({id:z.string().min(1).max(80),label:z.string().min(2).max(240),type:questionnaireFieldTypeSchema,required:z.boolean().default(false),options:z.array(z.string().min(1).max(120)).max(30).optional(),helpText:z.string().max(500).optional()}).superRefine((field,ctx)=>{if(["select","multi_select"].includes(field.type)&&!field.options?.length)ctx.addIssue({code:"custom",message:"Options are required for selection fields",path:["options"]})});
export const createLeadSchema=z.object({organizationId:z.string().min(1),name:z.string().min(2).max(160),company:z.string().min(2).max(200),email:z.string().email().or(z.literal("")).optional(),phone:z.string().max(50).optional(),value:z.number().nonnegative().default(0),source:z.string().max(120).optional(),assigneeId:z.string().max(128).optional(),tags:z.array(z.string().min(1).max(40)).max(20).default([])});
export const updateLeadSchema=z.object({organizationId:z.string().min(1),status:leadStatusSchema.optional(),notes:z.string().max(10000).optional(),value:z.number().nonnegative().optional(),assigneeId:z.string().max(128).nullable().optional(),tags:z.array(z.string().min(1).max(40)).max(20).optional()});
export const createCustomerSchema=z.object({organizationId:z.string().min(1),leadId:z.string().min(1).optional(),businessName:z.string().min(2).max(200),legalName:z.string().max(200).optional(),industry:z.string().min(2).max(120),website:z.string().url().or(z.literal("")).optional(),locale:localeSchema.default("he"),tags:z.array(z.string().min(1).max(40)).max(20).default([]),contacts:z.array(z.object({name:z.string().min(2).max(160),email:z.string().email(),phone:z.string().max(50).optional(),role:z.string().max(100).optional(),primary:z.boolean().default(false)})).min(1).max(30)});
export const createProjectSchema=z.object({organizationId:z.string().min(1),customerId:z.string().min(1),leadId:z.string().min(1),name:z.string().min(2).max(200),websiteGoal:z.string().min(10).max(3000),budget:z.number().nonnegative().default(0),dealEvidence:z.string().min(10).max(2000),deadline:z.string().datetime().optional(),locale:localeSchema.default("he")});
export const createQuestionnaireSchema=z.object({organizationId:z.string().min(1),title:z.string().min(2).max(200),fields:z.array(questionnaireFieldSchema).min(1).max(100)});
export const questionnaireResponseSchema=z.record(z.union([z.string().max(20000),z.boolean(),z.array(z.string().max(1000)).max(100)]));
export const submitQuestionnaireSchema=z.object({organizationId:z.string().min(1),responses:questionnaireResponseSchema,filePaths:z.array(z.string().min(1).max(1000)).max(100).default([])});

export function validateRequiredQuestionnaireFields(fields:z.infer<typeof questionnaireFieldSchema>[],responses:z.infer<typeof questionnaireResponseSchema>,filePaths:string[]){const missing=fields.filter(field=>{if(!field.required)return false;if(field.type==="file")return !filePaths.some(path=>path.includes(`/${field.id}/`));const value=responses[field.id];return value===undefined||value===false||value===""||(Array.isArray(value)&&value.length===0)}).map(field=>field.id);if(missing.length)throw new Error(`Missing required questionnaire fields: ${missing.join(", ")}`)}

export const questionnaireAgentPlan:readonly{agentId:z.infer<typeof agentIdSchema>;objective:string;approvalRequired:boolean}[]=[
  {agentId:"website-architect",objective:"Create the verified website strategy, sitemap, information architecture, and delivery plan from the completed client questionnaire.",approvalRequired:false},
  {agentId:"ui-ux-designer",objective:"Prepare the design direction and interface system from the approved architecture and verified client brand inputs.",approvalRequired:true},
  {agentId:"content",objective:"Create transformation-focused website copy from verified client, audience, offer, and brand inputs.",approvalRequired:true},
  {agentId:"seo",objective:"Produce the keyword map, on-page requirements, technical SEO plan, and internal-linking strategy.",approvalRequired:false},
];
