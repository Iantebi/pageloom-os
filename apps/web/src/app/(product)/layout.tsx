import {ProductShell} from "@/components/product-shell";
import {RoleScopedExtras} from "@/components/role-scoped-extras";
import {RouteErrorBoundary} from "@/components/route-error-boundary";
export default function ProductLayout({children}:{children:React.ReactNode}){return <ProductShell><RouteErrorBoundary variant="widget"><RoleScopedExtras/></RouteErrorBoundary>{children}</ProductShell>}
