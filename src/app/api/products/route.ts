import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/products - 公开产品列表（无需登录）
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const ids = searchParams.get('ids'); // 逗号分隔的 ID 列表

        const whereClause: any = { active: true };

        // 如果传入了 ids 参数，只返回指定的产品
        if (ids) {
            const idList = ids.split(',').filter(Boolean);
            if (idList.length > 0) {
                whereClause.id = { in: idList };
            }
        }

        const products = await prisma.product.findMany({
            where: whereClause,
            orderBy: { sortOrder: 'asc' },
            select: {
                id: true,
                name: true,
                nameEn: true,
                category: true,
                image: true,
                price: true,
                description: true,
                keyIngredients: true,
                suitableSkinTypes: true,
                benefits: true,
                step: true,
                affiliateLinks: true,
            }
        });

        return NextResponse.json(products);
    } catch (error) {
        console.error("Failed to fetch products:", error);
        return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
    }
}
