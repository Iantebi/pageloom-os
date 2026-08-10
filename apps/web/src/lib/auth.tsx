"use client";

import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import {GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut as firebaseSignOut,type User} from "firebase/auth";
import {firebaseAuth,firebaseConfigured} from "./firebase";

type AuthContextValue={
  user:User|null;
  loading:boolean;
  signIn:()=>Promise<void>;
  signOut:()=>Promise<void>;
};

const AuthContext=createContext<AuthContextValue|undefined>(undefined);
const googleProvider=new GoogleAuthProvider();

export function AuthProvider({children}:{children:ReactNode}){
  const[user,setUser]=useState<User|null>(null);
  const[loading,setLoading]=useState(firebaseConfigured);

  useEffect(()=>{
    if(!firebaseConfigured)return;
    return onAuthStateChanged(firebaseAuth,nextUser=>{setUser(nextUser);setLoading(false)},()=>{setUser(null);setLoading(false)});
  },[]);

  const value=useMemo<AuthContextValue>(()=>({
    user,
    loading,
    signIn:async()=>{
      if(!firebaseConfigured)throw new Error("Firebase browser configuration is required before sign-in");
      await signInWithPopup(firebaseAuth,googleProvider);
    },
    signOut:()=>firebaseSignOut(firebaseAuth),
  }),[user,loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(){
  const context=useContext(AuthContext);
  if(!context)throw new Error("useAuth must be used within AuthProvider");
  return context;
}
