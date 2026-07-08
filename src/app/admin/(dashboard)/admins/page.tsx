import { AdminsClient } from "@/components/admin/AdminsClient";
import { verifyAdminSession } from "@/lib/admin-auth";
import { canManageAdmins } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
    const admin = await verifyAdminSession();
    if (!admin) {
        redirect("/admin/login");
    }
    // Only super_admin can access this page
    if (!canManageAdmins(admin.role)) {
        redirect("/admin/products");
    }
    return <AdminsClient />;
}
