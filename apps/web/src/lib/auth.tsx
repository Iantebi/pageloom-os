"use client";import{createContext,useContext,useEffect,useState}from"react";import{GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut as firebaseSignOut,type MultiFactorResolver,type User}from"firebase/auth";import{firebaseAuth}from"./firebase";import{completeTotpSignIn,isMfaRequiredError,resolverFromError,totpHint}from"./mfa";import{t}from"./i18n";
type AuthState={user:User|null;loading:boolean;error:string;signIn:()=>Promise<void>;signOut:()=>Promise<void>;mfaResolver:MultiFactorResolver|null;cancelMfaSignIn:()=>void;completeMfaSignIn:(code:string)=>Promise<void>};const Context=createContext<AuthState|null>(null);
function authErrorMessage(failure:unknown):string{const code=(failure as{code?:string})?.code;const e=t("authErrors");if(code==="auth/unauthorized-domain")return e.unauthorizedDomain;if(code==="auth/popup-blocked")return e.popupBlocked;if(code==="auth/popup-closed-by-user")return e.popupClosed;if(code==="auth/cancelled-popup-request")return"";if(code==="auth/network-request-failed")return e.networkError;if(code==="auth/operation-not-allowed")return e.operationNotAllowed;return e.generic}
export function AuthProvider({children}:{children:React.ReactNode}){const[user,setUser]=useState<User|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState("");const[mfaResolver,setMfaResolver]=useState<MultiFactorResolver|null>(null);useEffect(()=>onAuthStateChanged(firebaseAuth,value=>{setUser(value);setLoading(false)}),[]);
  // A popup keeps the whole OAuth handshake in one window (opener <-> popup postMessage),
  // unlike signInWithRedirect which round-trips through the authDomain's /__/auth/handler
  // page and depends on that pending-redirect state surviving a full top-level navigation.
  // Chrome's third-party storage partitioning frequently breaks that hand-off on localhost
  // (and increasingly in production too), silently dropping the user back at sign-in.
  async function signIn(){setError("");setMfaResolver(null);try{await signInWithPopup(firebaseAuth,new GoogleAuthProvider())}catch(failure){
    // Firebase throws this mid-handshake, before a session exists, whenever the signed-in
    // Google account has an enrolled second factor - onAuthStateChanged never fires and
    // `user` stays null until completeMfaSignIn() below finishes the challenge.
    if(isMfaRequiredError(failure)){setMfaResolver(resolverFromError(failure));return}
    const message=authErrorMessage(failure);if(message)setError(message)}}
  // Deliberately left to throw on failure (a wrong/expired code) rather than swallowed into the
  // shared `error` string above - the MFA challenge UI owns its own busy/error state, same as
  // every other form in this app (see team-access.tsx, account-security.tsx).
  async function completeMfaSignIn(code:string){if(!mfaResolver)return;const hint=totpHint(mfaResolver);if(!hint)throw new Error("No authenticator-app factor is enrolled for this account");await completeTotpSignIn(mfaResolver,hint,code);setMfaResolver(null)}
  return <Context.Provider value={{user,loading,error,signIn,signOut:()=>firebaseSignOut(firebaseAuth),mfaResolver,cancelMfaSignIn:()=>setMfaResolver(null),completeMfaSignIn}}>{children}</Context.Provider>}
export function useAuth(){const value=useContext(Context);if(!value)throw new Error("AuthProvider is missing");return value}
