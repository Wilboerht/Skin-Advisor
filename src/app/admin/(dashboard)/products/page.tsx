
import prisma from "@/lib/prisma";
import ProductsClient from "@/components/admin/ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
    const products = await prisma.product.findMany({
        orderBy: { sortOrder: 'asc' }
    });

    // Serialize for client component
    const serializedProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        nameEn: p.nameEn,
        category: p.category,
        price: p.price,
        image: p.image,
        active: p.active,
        featured: p.featured,
        stock: p.stock,
        sortOrder: p.sortOrder,
    }));

    return <ProductsClient initialProducts={serializedProducts} />;
}
