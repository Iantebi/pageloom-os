import * as logger from "firebase-functions/logger";

type AuditSeverity="info"|"warning"|"error";
export function operationalLog(severity:AuditSeverity,event:string,fields:Record<string,string|number|boolean|undefined>={}){const metadata=Object.fromEntries(Object.entries(fields).filter(([,value])=>value!==undefined));if(severity==="error")logger.error(event,metadata);else if(severity==="warning")logger.warn(event,metadata);else logger.info(event,metadata)}
export function safeErrorName(error:unknown){return error instanceof Error?error.name:"UnknownError"}
