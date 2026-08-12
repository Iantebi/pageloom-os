import {ProductShell} from "@/components/product-shell";
import {ClientManagementWidgets} from "@/components/client-management-widgets";
export default function ProductLayout({children}:{children:React.ReactNode}){return <ProductShell><ClientManagementWidgets/>{children}</ProductShell>}
