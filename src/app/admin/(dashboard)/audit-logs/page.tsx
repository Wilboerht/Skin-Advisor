import type { Metadata } from "next";
import AuditLogsClient from "@/components/admin/AuditLogsClient";
import { verifyAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "审计日志",
  description: "NIHPLOD 管理后台 — 操作审计日志。",
};

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
    const admin = await verifyAdminSession();
    if (!admin) {
        redirect("/admin/login");
    }
    return <AuditLogsClient role={admin.role} />;
}
