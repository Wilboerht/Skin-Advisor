import { redirect } from "next/navigation";
import type { Metadata } from "next";
import ProductsClient from "@/components/admin/ProductsClient";
import { verifyAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "产品管理",
    robots: { index: false, follow: false },
};

export default async function ProductsPage() {
    const admin = await verifyAdminSession();
    if (!admin) {
        redirect("/admin/login");
    }
    return <ProductsClient role={admin.role} />;
}
