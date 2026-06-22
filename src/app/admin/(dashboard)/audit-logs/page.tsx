
import AuditLogsClient from "@/components/admin/AuditLogsClient";
import { verifyAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
    const admin = await verifyAdminSession();
    if (!admin) {
        redirect("/admin/login");
    }
    return <AuditLogsClient role={admin.role} />;
}
