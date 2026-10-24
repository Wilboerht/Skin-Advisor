import { notFound, redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import ProductEditorPage from "@/components/admin/ProductEditorPage";
import {
    normalizeImagePath,
    normalizeImages,
    parseAffiliateLinks,
    parseStringArray,
    type ProductFormData,
} from "@/types/product";
import { normalizeProductPurchaseLinks } from "@/lib/product-links";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
    const admin = await verifyAdminSession();
    if (!admin) redirect("/admin/login");

    const { id } = await params;
    const query = await searchParams;
    const raw = Array.isArray(query.returnTo)
        ? query.returnTo[0]
        : query.returnTo;
    const returnTo = raw?.startsWith("/admin") ? raw : "/admin/products";

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) notFound();

    const formData: ProductFormData = {
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        image: normalizeImagePath(product.image),
        images: normalizeImages(product.images),
        description: product.description,
        howToUse: product.howToUse,
        origin: product.origin,
        capacity: product.capacity,
        active: product.active,
        featured: product.featured,
        keyIngredients: parseStringArray(product.keyIngredients),
        benefits: parseStringArray(product.benefits),
        negativeFor: parseStringArray(product.negativeFor),
        suitableSkinTypes: parseStringArray(product.suitableSkinTypes),
        affiliateLinks: parseAffiliateLinks(product.affiliateLinks),
        purchaseLinks: normalizeProductPurchaseLinks(
            product.purchaseLinks,
            product.affiliateLinks,
        ) as unknown as ProductFormData["purchaseLinks"],
        recommendReasons:
            (product.recommendReasons as ProductFormData["recommendReasons"]) ??
            null,
    };

    return <ProductEditorPage product={formData} returnTo={returnTo} />;
}
