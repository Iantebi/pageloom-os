import type{Metadata}from"next";import"./globals.css";import{AuthProvider}from"@/lib/auth";
export const metadata:Metadata={title:"PageLoom OS",description:"AI-native website agency control plane"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" dir="ltr"><body><AuthProvider>{children}</AuthProvider></body></html>}

