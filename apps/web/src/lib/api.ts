import{firebaseAuth}from"./firebase";import{t}from"./i18n";

// Extends Error (not a bare object) so every existing `failure instanceof Error ? failure.message
// : ...` call site across the app keeps working unchanged — this is purely additive. `status`
// lets a caller that cares (see lib/discovery.ts's classifyApiErrorKind) distinguish "offline",
// "session expired" (401), "not authorized for this resource" (403), and "something else" without
// parsing the message string.
export class ApiError extends Error{status:number|"network";constructor(message:string,status:number|"network"){super(message);this.name="ApiError";this.status=status}}

export async function api<T>(path:string,init?:RequestInit):Promise<T>{
  const token=await firebaseAuth.currentUser?.getIdToken();
  const e=t("apiErrors");
  let response:Response;
  try{
    response=await fetch(`/api${path}`,{...init,cache:"no-store",headers:{accept:"application/json","content-type":"application/json",...init?.headers,...(token?{authorization:`Bearer ${token}`}:{})}});
  }catch{
    throw new ApiError(e.requestFailed,"network");
  }
  const contentType=response.headers.get("content-type")??"";
  if(!contentType.includes("application/json"))throw new ApiError(e.unexpectedResponse(response.status,contentType||e.withoutContentType),response.status);
  const body=await response.json();
  if(!response.ok)throw new ApiError(body.error?.message??e.requestFailed,response.status);
  return body.data as T;
}

export type ApiErrorKind="network"|"session_expired"|"permission_denied"|"generic";

/** Classifies any error from api()/apiFile() into a UI-actionable kind. Returns "generic" for
 *  anything that isn't an ApiError (e.g. a thrown string) so callers always get an exhaustive
 *  value to switch on. */
export function classifyApiErrorKind(failure:unknown):ApiErrorKind{
  if(!(failure instanceof ApiError))return"generic";
  if(failure.status==="network")return"network";
  if(failure.status===401)return"session_expired";
  if(failure.status===403)return"permission_denied";
  return"generic";
}
export async function apiFile(path:string){const token=await firebaseAuth.currentUser?.getIdToken(),response=await fetch(`/api${path}`,{cache:"no-store",headers:{...(token?{authorization:`Bearer ${token}`}:{})}});if(!response.ok){const body=await response.json().catch(()=>undefined);throw new Error(body?.error?.message??t("apiErrors").fileRequestFailed)}return response.blob()}
