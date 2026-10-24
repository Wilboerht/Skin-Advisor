import { redirect } from "next/navigation";
import ProductsClient from "@/components/admin/ProductsClient";
import { verifyAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
    const admin = await verifyAdminSession();
    if (!admin) {
        redirect("/admin/login");
    }
    return <ProductsClient role={admin.role} />;
}
