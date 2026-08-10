import {firebaseAuth,firebaseConfigured} from "./firebase";

type ApiErrorBody={error?:{code?:string;message?:string;issues?:unknown}};
type ApiSuccessBody<T>={data:T};

export class ApiError extends Error{
  constructor(public readonly status:number,public readonly code:string,public readonly issues?:unknown){
    super(code);
    this.name="ApiError";
  }
}

export async function api<T=unknown>(path:string,init:RequestInit={}):Promise<T>{
  if(!firebaseConfigured)throw new Error("Firebase browser configuration is required before calling the API");
  const user=firebaseAuth.currentUser;
  if(!user)throw new ApiError(401,"UNAUTHENTICATED");

  const headers=new Headers(init.headers);
  headers.set("Authorization",`Bearer ${await user.getIdToken()}`);
  if(init.body&&!headers.has("Content-Type"))headers.set("Content-Type","application/json");

  const response=await fetch(`/api${path.startsWith("/")?path:`/${path}`}`,{...init,headers});
  if(response.status===204)return undefined as T;

  const body=await response.json().catch(()=>({})) as ApiSuccessBody<T>&ApiErrorBody;
  if(!response.ok){
    const code=body.error?.code??"REQUEST_FAILED";
    const error=new ApiError(response.status,code,body.error?.issues);
    error.message=body.error?.message??`API request failed with status ${response.status}`;
    throw error;
  }
  return body.data;
}
