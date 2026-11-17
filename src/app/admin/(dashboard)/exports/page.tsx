import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { ExportsClient } from "./ExportsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "数据导出",
    description: "管理后台 — 产品、用户、诊断请求、白皮书与审计数据导出。",
    robots: { index: false, follow: false },
};

export default async function ExportsPage() {
    const admin = await verifyAdminSession();
    if (!admin) {
        redirect("/admin/login");
    }

    return <ExportsClient role={admin.role} />;
}
