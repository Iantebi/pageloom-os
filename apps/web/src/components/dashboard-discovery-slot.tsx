"use client";
import { usePathname } from "next/navigation";
import { DiscoveryManagementList } from "./discovery-management-list";

export function DashboardDiscoverySlot() {
  return usePathname() === "/dashboard" ? <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8"><DiscoveryManagementList compact /></div> : null;
}
