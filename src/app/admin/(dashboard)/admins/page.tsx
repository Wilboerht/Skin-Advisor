import { AdminsClient } from "@/components/admin/AdminsClient";
import { verifyAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
    const admin = await verifyAdminSession();
    if (!admin) {
        redirect("/admin/login");
    }
    // Only super_admin can access this page
    if (admin.role !== "super_admin") {
        redirect("/admin/products");
    }
    return <AdminsClient />;
}
