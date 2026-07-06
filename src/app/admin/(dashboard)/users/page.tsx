import type { Metadata } from "next";
import { UsersClient } from "@/components/admin/UsersClient";
import { verifyAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "用户管理",
  description: "NIHPLOD 管理后台 — 用户管理。",
};

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
    const admin = await verifyAdminSession();
    if (!admin) {
        redirect("/admin/login");
    }
    // User management available to super_admin and admin
    return <UsersClient />;
}
