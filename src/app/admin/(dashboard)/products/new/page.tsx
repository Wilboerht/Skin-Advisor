import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import ProductEditorPage from "@/components/admin/ProductEditorPage";

export const dynamic = "force-dynamic";

export default async function NewProductPage({
    searchParams,
}: {
    searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
    const admin = await verifyAdminSession();
    if (!admin) redirect("/admin/login");
    const params = await searchParams;
    const raw = Array.isArray(params.returnTo)
        ? params.returnTo[0]
        : params.returnTo;
    const returnTo = raw?.startsWith("/admin") ? raw : "/admin/products";
    return <ProductEditorPage product={null} returnTo={returnTo} />;
}
