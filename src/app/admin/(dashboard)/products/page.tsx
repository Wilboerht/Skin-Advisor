
import prisma from "@/lib/prisma";
import ProductsClient from "@/components/admin/ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
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
        images: p.images,
        description: p.description,
        howToUse: p.howToUse,
        keyIngredients: p.keyIngredients,
        suitableSkinTypes: p.suitableSkinTypes,
        benefits: p.benefits,
        negativeFor: p.negativeFor,
        affiliateLinks: p.affiliateLinks,
        active: p.active,
        featured: p.featured,
        sortOrder: p.sortOrder,
    }));

    return <ProductsClient initialProducts={serializedProducts} />;
}
