"use client";import{createContext,useContext,useEffect,useState}from"react";import{GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut as firebaseSignOut,type User}from"firebase/auth";import{firebaseAuth}from"./firebase";import{t}from"./i18n";
type AuthState={user:User|null;loading:boolean;error:string;signIn:()=>Promise<void>;signOut:()=>Promise<void>};const Context=createContext<AuthState|null>(null);
function authErrorMessage(failure:unknown):string{const code=(failure as{code?:string})?.code;const e=t("authErrors");if(code==="auth/unauthorized-domain")return e.unauthorizedDomain;if(code==="auth/popup-blocked")return e.popupBlocked;if(code==="auth/popup-closed-by-user")return e.popupClosed;if(code==="auth/cancelled-popup-request")return"";if(code==="auth/network-request-failed")return e.networkError;if(code==="auth/operation-not-allowed")return e.operationNotAllowed;return e.generic}
export function AuthProvider({children}:{children:React.ReactNode}){const[user,setUser]=useState<User|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState("");useEffect(()=>onAuthStateChanged(firebaseAuth,value=>{setUser(value);setLoading(false)}),[]);
  // A popup keeps the whole OAuth handshake in one window (opener <-> popup postMessage),
  // unlike signInWithRedirect which round-trips through the authDomain's /__/auth/handler
  // page and depends on that pending-redirect state surviving a full top-level navigation.
  // Chrome's third-party storage partitioning frequently breaks that hand-off on localhost
  // (and increasingly in production too), silently dropping the user back at sign-in.
  async function signIn(){setError("");try{await signInWithPopup(firebaseAuth,new GoogleAuthProvider())}catch(failure){const message=authErrorMessage(failure);if(message)setError(message)}}
  return <Context.Provider value={{user,loading,error,signIn,signOut:()=>firebaseSignOut(firebaseAuth)}}>{children}</Context.Provider>}
export function useAuth(){const value=useContext(Context);if(!value)throw new Error("AuthProvider is missing");return value}
