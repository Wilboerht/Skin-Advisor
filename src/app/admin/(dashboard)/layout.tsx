import type { Metadata } from "next";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "数据总览",
  description: "NIHPLOD 管理后台 — 数据总览与统计。",
};

import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { ToastProvider } from "@/components/ui/Toast";

import { verifyAdminSession } from "@/lib/admin-auth";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await verifyAdminSession();

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <ToastProvider>
      <div className="flex h-screen bg-[#FDFBF7] text-[#1A1A1A] font-sans">
        <a
          href="#admin-main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#1A1A1A] focus:text-white focus:rounded-lg focus:text-sm"
        >
          跳转到主内容
        </a>
        <AdminSidebar />
        <main id="admin-main-content" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-[#C9A86C]" /></div>}>
              {children}
            </Suspense>
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
