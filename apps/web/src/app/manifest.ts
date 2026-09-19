import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "PageLoom OS",
    short_name: "PageLoom",
    description: "מערכת ההפעלה של סוכנות האתרים מבוססת ה-AI",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f7f7f5",
    theme_color: "#141512",
    lang: "he",
    dir: "rtl",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Windows/Android "desktop shortcut" jump-list entries — a right-click on the installed
    // app's taskbar/home-screen icon offers these as direct deep links, without opening the app
    // shell first. Owner Workspace routes only (see the 2026-09-18 separation rule) — never /master.
    shortcuts: [
      { name: "לוח בקרה", url: "/dashboard", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "לקוחות", url: "/crm", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "אפיון", url: "/discoveries", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
