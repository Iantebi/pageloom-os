import{firebaseAuth}from"./firebase";
export async function api<T>(path:string,init?:RequestInit):Promise<T>{
  const token=await firebaseAuth.currentUser?.getIdToken();
  const response=await fetch(`/api${path}`,{...init,cache:"no-store",headers:{accept:"application/json","content-type":"application/json",...init?.headers,...(token?{authorization:`Bearer ${token}`}:{})}});
  const contentType=response.headers.get("content-type")??"";
  if(!contentType.includes("application/json"))throw new Error(`PageLoom API returned ${response.status} ${contentType||"without a content type"}`);
  const body=await response.json();
  if(!response.ok)throw new Error(body.error?.message??"Request failed");
  return body.data as T;
}
export async function apiFile(path:string){const token=await firebaseAuth.currentUser?.getIdToken(),response=await fetch(`/api${path}`,{cache:"no-store",headers:{...(token?{authorization:`Bearer ${token}`}:{})}});if(!response.ok){const body=await response.json().catch(()=>undefined);throw new Error(body?.error?.message??"File request failed")}return response.blob()}
