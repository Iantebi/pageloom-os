import {ProductShell} from "@/components/product-shell";
import {RoleScopedExtras} from "@/components/role-scoped-extras";
import {RouteErrorBoundary} from "@/components/route-error-boundary";
import {DashboardDiscoverySlot} from "@/components/dashboard-discovery-slot";
export default function ProductLayout({children}:{children:React.ReactNode}){return <ProductShell><RouteErrorBoundary variant="widget"><RoleScopedExtras/></RouteErrorBoundary><DashboardDiscoverySlot/>{children}</ProductShell>}
