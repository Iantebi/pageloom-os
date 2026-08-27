import{firebaseAuth}from"./firebase";import{t}from"./i18n";
export async function api<T>(path:string,init?:RequestInit):Promise<T>{
  const token=await firebaseAuth.currentUser?.getIdToken();
  const response=await fetch(`/api${path}`,{...init,cache:"no-store",headers:{accept:"application/json","content-type":"application/json",...init?.headers,...(token?{authorization:`Bearer ${token}`}:{})}});
  const contentType=response.headers.get("content-type")??"";
  const e=t("apiErrors");
  if(!contentType.includes("application/json"))throw new Error(e.unexpectedResponse(response.status,contentType||e.withoutContentType));
  const body=await response.json();
  if(!response.ok)throw new Error(body.error?.message??e.requestFailed);
  return body.data as T;
}
export async function apiFile(path:string){const token=await firebaseAuth.currentUser?.getIdToken(),response=await fetch(`/api${path}`,{cache:"no-store",headers:{...(token?{authorization:`Bearer ${token}`}:{})}});if(!response.ok){const body=await response.json().catch(()=>undefined);throw new Error(body?.error?.message??t("apiErrors").fileRequestFailed)}return response.blob()}
