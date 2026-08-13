import {ProductShell} from "@/components/product-shell";
import {RoleScopedExtras} from "@/components/role-scoped-extras";
export default function ProductLayout({children}:{children:React.ReactNode}){return <ProductShell><RoleScopedExtras/>{children}</ProductShell>}
