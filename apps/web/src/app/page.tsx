"use client";import {useEffect} from "react";import {useRouter} from "next/navigation";
export default function Home(){const router=useRouter();useEffect(()=>router.replace("/dashboard"),[router]);return <main className="grid min-h-screen place-items-center bg-[#f7f7f5]"><span className="logo-mark">P</span></main>}
