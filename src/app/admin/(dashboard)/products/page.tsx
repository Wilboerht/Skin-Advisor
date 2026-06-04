
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

    const products = await prisma.product.findMany({
        orderBy: { sortOrder: 'asc' },
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
        sortOrder: p.sortOrder,
    }));

    return <ProductsClient initialProducts={serializedProducts} />;
}
