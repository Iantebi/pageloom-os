"use client";
import {useEffect,useState} from "react";
import {collection,limit,onSnapshot,orderBy,query,where,type DocumentData} from "firebase/firestore";
import {firestore} from "./firebase";

export function useLiveCollection<T extends DocumentData>(path:string|undefined,sortField="updatedAt",max=100,whereField?:string,whereValue?:unknown){
  const[data,setData]=useState<T[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState<string>();
  useEffect(()=>{if(!path)return;const source=collection(firestore,path),statement=whereField&&whereValue!==undefined?query(source,where(whereField,"==",whereValue),orderBy(sortField,"desc"),limit(max)):query(source,orderBy(sortField,"desc"),limit(max));return onSnapshot(statement,snapshot=>{setData(snapshot.docs.map(doc=>({id:doc.id,...doc.data()})as unknown as T));setLoading(false);setError(undefined)},failure=>{setError(failure.message);setLoading(false)})},[path,sortField,max,whereField,whereValue]);
  return{data,loading,error};
}
