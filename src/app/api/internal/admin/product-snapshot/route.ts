import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorizeInternalRequest } from "@/lib/internal-api";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export const maxDuration = 15;
export const dynamic = "force-dynamic";

const MAX_PRODUCTS = 2000;

/**
 * 内部接口：测肤推荐产品库只读快照（供主站控制中台做产品数据盘点）
 *
 * GET /api/internal/admin/product-snapshot
 *   → { success, data: { products, truncated, generatedAt } }
 *
 * 仅返回产品公开字段，不含用户/问卷等敏感数据；只读，不写库。
 */
export async function GET(request: NextRequest) {
    const auth = await authorizeInternalRequest(request, {
        legacy: "bearer-advisor-secret",
    });
    if (!auth.ok) {
        const message =
            auth.reason === "advisor_secret_not_configured"
                ? "ADVISOR_INTERNAL_SECRET not configured"
                : "Unauthorized";
        return NextResponse.json({ error: message }, { status: auth.status ?? 401 });
    }

    const ip = getClientIP(request);
    const ipLimit = await rateLimit(`internal-admin-product-snapshot-ip-${ip}`, "default", {
        maxRequests: 30,
        windowMs: 60 * 1000,
    });
    if (!ipLimit.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const products = await prisma.product.findMany({
            orderBy: { createdAt: "asc" },
            take: MAX_PRODUCTS,
            select: {
                id: true,
                name: true,
                category: true,
                price: true,
                capacity: true,
                image: true,
                images: true,
                description: true,
                keyIngredients: true,
                benefits: true,
                suitableSkinTypes: true,
                negativeFor: true,
                recommendReasons: true,
                purchaseLinks: true,
                affiliateLinks: true,
                active: true,
                featured: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: {
                products: products.map((product) => ({
                    ...product,
                    updatedAt: product.updatedAt.toISOString(),
                })),
                truncated: products.length >= MAX_PRODUCTS,
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error("[internal/admin/product-snapshot] failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
