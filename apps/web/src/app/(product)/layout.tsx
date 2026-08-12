import {ProductShell} from "@/components/product-shell";
import {ClientManagementWidgets} from "@/components/client-management-widgets";
import {OperationsHealthCard} from "@/components/operations-health-card";
export default function ProductLayout({children}:{children:React.ReactNode}){return <ProductShell><ClientManagementWidgets/><OperationsHealthCard/>{children}</ProductShell>}
