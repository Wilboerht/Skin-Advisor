
import prisma from "@/lib/prisma";
import ProductsClient from "@/components/admin/ProductsClient";
import { verifyAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
    const admin = await verifyAdminSession();
    if (!admin) {
        redirect("/admin/login");
    }

    // NOTE: 当前业务场景产品数量不超过 20 个，1000 的 limit 是为了避免 SSR 时无限制加载。
    // 若未来产品数量显著增长，应改为服务端分页（skip/take）+ 前端分页 UI。
    const products = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1000
    });

    // Serialize for client component
    const serializedProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        image: p.image,
        images: Array.isArray(p.images) ? p.images as string[] : (p.images ? [String(p.images)] : []),
        description: p.description,
        howToUse: p.howToUse,
        keyIngredients: Array.isArray(p.keyIngredients) ? p.keyIngredients as string[] : [],
        suitableSkinTypes: Array.isArray(p.suitableSkinTypes) ? p.suitableSkinTypes as string[] : [],
        benefits: Array.isArray(p.benefits) ? p.benefits as string[] : [],
        negativeFor: Array.isArray(p.negativeFor) ? p.negativeFor as string[] : [],
        affiliateLinks: p.affiliateLinks as Record<string, string> | null,
        active: p.active,
        featured: p.featured,
    }));

    return <ProductsClient initialProducts={serializedProducts} />;
}
