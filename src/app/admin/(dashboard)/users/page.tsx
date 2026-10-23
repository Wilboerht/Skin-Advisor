import type { Metadata } from "next";
import { UsersClient } from "@/components/admin/UsersClient";
import { verifyAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "用户管理",
  description: "NIHPLOD 管理后台 — 用户管理。",
};

export const dynamic = 'force-dynamic';

export default async function UsersPage({
    searchParams,
}: {
    searchParams: Promise<{ userId?: string | string[] }>;
}) {
    const admin = await verifyAdminSession();
    if (!admin) {
        redirect("/admin/login");
    }

    // 主站控制中台深链：/admin/users?userId=<主站用户 id> 打开对应用户详情
    const params = await searchParams;
    const rawUserId = params.userId;
    const initialUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

    // User management available to super_admin and admin
    return <UsersClient role={admin.role} initialUserId={initialUserId || null} />;
}
