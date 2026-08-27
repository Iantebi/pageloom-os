import type{Metadata}from"next";import{Heebo}from"next/font/google";import"./globals.css";import{AuthProvider}from"@/lib/auth";
const heebo=Heebo({subsets:["hebrew","latin"],variable:"--font-heebo"});
export const metadata:Metadata={title:"PageLoom OS",description:"מערכת ההפעלה של סוכנות האתרים מבוססת ה-AI"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="he" dir="rtl" className={heebo.variable}><body><AuthProvider>{children}</AuthProvider></body></html>}

