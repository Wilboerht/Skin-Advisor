import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "数据总览",
  description: "NIHPLOD 管理后台 — 数据总览与统计。",
};

import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { ToastProvider } from "@/components/ui/Toast";

import { verifyAdminSession } from "@/lib/admin-auth";

export default async function AdminDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Full session validation: parse cookie JSON, verify admin exists in DB
    const admin = await verifyAdminSession();

    if (!admin) {
        redirect("/admin/login");
    }

    return (
        <ToastProvider>
            <div className="flex h-screen bg-[#FDFBF7] text-[#1A1A1A] font-sans">
                <AdminSidebar />
                <main className="flex-1 overflow-y-auto p-8">
                    <div className="mx-auto max-w-6xl">
                        {children}
                    </div>
                </main>
            </div>
        </ToastProvider>
    );
}
