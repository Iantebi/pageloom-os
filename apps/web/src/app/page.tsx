"use client";import {useEffect,useState} from "react";import {useRouter} from "next/navigation";import dynamic from "next/dynamic";
// Lazy, not a static import: eagerly importing DiscoveryLinkFlow here would pull the entire
// AI Studio Discovery bundle into "/" itself — the route every ordinary visit hits on its way to
// an immediate redirect to /dashboard. Only a /d/{token} visit ever needs this code at all.
const DiscoveryLinkFlow=dynamic(()=>import("@/components/discovery-link-flow").then(module=>module.DiscoveryLinkFlow),{ssr:false});

// Firebase Hosting's catch-all rewrite ("**": "/index.html", see firebase.json) serves THIS page's
// build output for any path with no matching static file — including a "New Client" Discovery link
// at /d/{token} (see docs/client-playbook/03-send-discovery.md). Static export can't register /d/
// as a real dynamic route (every possible token would need to be known at build time), so this reads
// the real browser pathname instead and branches before ever redirecting to the dashboard.
function discoveryLinkToken(pathname: string): string | undefined {
  const match = /^\/d\/([A-Za-z0-9_-]{16,64})\/?$/.exec(pathname);
  return match?.[1];
}

export default function Home(){
  const router=useRouter();
  // Lazy initializer, not an effect: window.location is already known on first client render, so
  // there's no "flash of dashboard-redirect" waiting-state to manage, and no synchronous setState
  // inside an effect body (react-hooks/set-state-in-effect) to avoid.
  const [token]=useState<string|undefined>(()=>typeof window==="undefined"?undefined:discoveryLinkToken(window.location.pathname));
  useEffect(()=>{if(!token)router.replace("/dashboard")},[token,router]);
  if(token)return <DiscoveryLinkFlow token={token} />;
  return <main className="grid min-h-screen place-items-center bg-[var(--bg)]"><span className="logo-mark">P</span></main>;
}
