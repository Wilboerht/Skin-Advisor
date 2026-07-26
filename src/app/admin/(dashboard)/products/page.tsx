import prisma from "@/lib/prisma";
import ProductsClient from "@/components/admin/ProductsClient";
import { verifyAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import {
    SerializedProduct,
    normalizeImagePath,
    normalizeImages,
    parseStringArray,
    parseAffiliateLinks,
} from "@/types/product";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
    const admin = await verifyAdminSession();
    if (!admin) {
        redirect("/admin/login");
    }

    // 当前业务产品数量较少，使用 1000 的 limit 避免 SSR 时无限制加载。
    // 若未来产品数量显著增长，应改为服务端分页（skip/take）+ 前端分页 UI。
    const products = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1000
    });

    // Serialize for client component — normalize image paths and safely parse JSON fields
    const serializedProducts: SerializedProduct[] = products.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        image: normalizeImagePath(p.image),
        images: normalizeImages(p.images),
        description: p.description,
        howToUse: p.howToUse,
        keyIngredients: parseStringArray(p.keyIngredients),
        suitableSkinTypes: parseStringArray(p.suitableSkinTypes),
        benefits: parseStringArray(p.benefits),
        negativeFor: parseStringArray(p.negativeFor),
        affiliateLinks: parseAffiliateLinks(p.affiliateLinks),
        recommendReasons: (p.recommendReasons as Record<string, string> | null) ?? null,
        active: p.active,
        featured: p.featured,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
    }));

    return <ProductsClient initialProducts={serializedProducts} />;
}
