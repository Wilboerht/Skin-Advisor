import { UsersClient } from "@/components/admin/UsersClient";
import { verifyAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
    const admin = await verifyAdminSession();
    if (!admin) {
        redirect("/admin/login");
    }
    // User management available to super_admin and admin
    return <UsersClient />;
}
