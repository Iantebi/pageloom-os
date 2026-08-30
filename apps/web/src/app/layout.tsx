import type{Metadata,Viewport}from"next";import{Heebo}from"next/font/google";import"./globals.css";import{AuthProvider}from"@/lib/auth";import{ServiceWorkerRegistration}from"@/components/service-worker-registration";import{ThemeProvider,THEME_BOOTSTRAP_SCRIPT}from"@/lib/theme";
const heebo=Heebo({subsets:["hebrew","latin"],variable:"--font-heebo"});
export const metadata:Metadata={
  title:"PageLoom OS",
  description:"מערכת ההפעלה של סוכנות האתרים מבוססת ה-AI",
  manifest:"/manifest.webmanifest",
  icons:{icon:[{url:"/icon-192.png",sizes:"192x192",type:"image/png"},{url:"/icon-512.png",sizes:"512x512",type:"image/png"}],apple:[{url:"/apple-touch-icon.png",sizes:"180x180",type:"image/png"}]},
  appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"PageLoom"},
};
// PageLoom's shipped default is dark mode on its dark background - matches THEME_BOOTSTRAP_SCRIPT's
// fallback and DEFAULT_APPEARANCE in lib/theme.tsx, so this static tag is never wrong before the
// bootstrap script (below, in <head>, before first paint) rewrites it to the user's saved choice.
export const viewport:Viewport={themeColor:"#101210",width:"device-width",initialScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="he" dir="rtl" data-theme="dark" data-bg="dark" data-accent="violet" className={heebo.variable} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:THEME_BOOTSTRAP_SCRIPT}}/></head><body suppressHydrationWarning><ThemeProvider><AuthProvider>{children}</AuthProvider></ThemeProvider><ServiceWorkerRegistration/></body></html>}

