import type{Metadata,Viewport}from"next";import{Heebo}from"next/font/google";import"./globals.css";import{AuthProvider}from"@/lib/auth";import{ServiceWorkerRegistration}from"@/components/service-worker-registration";
const heebo=Heebo({subsets:["hebrew","latin"],variable:"--font-heebo"});
export const metadata:Metadata={
  title:"PageLoom OS",
  description:"מערכת ההפעלה של סוכנות האתרים מבוססת ה-AI",
  manifest:"/manifest.webmanifest",
  icons:{icon:[{url:"/icon-192.png",sizes:"192x192",type:"image/png"},{url:"/icon-512.png",sizes:"512x512",type:"image/png"}],apple:[{url:"/apple-touch-icon.png",sizes:"180x180",type:"image/png"}]},
  appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"PageLoom"},
};
export const viewport:Viewport={themeColor:"#141512",width:"device-width",initialScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="he" dir="rtl" className={heebo.variable}><body suppressHydrationWarning><AuthProvider>{children}</AuthProvider><ServiceWorkerRegistration/></body></html>}

