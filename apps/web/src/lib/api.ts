import{getToken as getAppCheckToken}from"firebase/app-check";import{firebaseAppCheck,firebaseAuth}from"./firebase";import{t}from"./i18n";
async function appCheckHeader():Promise<Record<string,string>>{if(!firebaseAppCheck)return{};try{const result=await getAppCheckToken(firebaseAppCheck,false);return result.token?{"X-Firebase-AppCheck":result.token}:{}}catch{return{}}}
export async function api<T>(path:string,init?:RequestInit):Promise<T>{
  const[token,appCheck]=await Promise.all([firebaseAuth.currentUser?.getIdToken(),appCheckHeader()]);
  const response=await fetch(`/api${path}`,{...init,cache:"no-store",headers:{accept:"application/json","content-type":"application/json",...init?.headers,...(token?{authorization:`Bearer ${token}`}:{}),...appCheck}});
  const contentType=response.headers.get("content-type")??"";
  const e=t("apiErrors");
  if(!contentType.includes("application/json"))throw new Error(e.unexpectedResponse(response.status,contentType||e.withoutContentType));
  const body=await response.json();
  if(!response.ok)throw new Error(body.error?.message??e.requestFailed);
  return body.data as T;
}
export async function apiFile(path:string){const[token,appCheck]=await Promise.all([firebaseAuth.currentUser?.getIdToken(),appCheckHeader()]),response=await fetch(`/api${path}`,{cache:"no-store",headers:{...(token?{authorization:`Bearer ${token}`}:{}),...appCheck}});if(!response.ok){const body=await response.json().catch(()=>undefined);throw new Error(body?.error?.message??t("apiErrors").fileRequestFailed)}return response.blob()}
