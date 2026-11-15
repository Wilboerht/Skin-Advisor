import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { withAdminAuth } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

// GET /api/admin/products - List products with pagination
// Available to super_admin and admin
export const GET = withAdminAuth(async (request: NextRequest) => {
    try {
        const ip = getClientIP(request);
        const rc = await rateLimit(`admin-products-${ip}`, "default", {
            maxRequests: 60,
            windowMs: 60 * 1000,
        });
        if (!rc.success) {
            return NextResponse.json(
                { error: "请求过于频繁" },
                { status: 429 },
            );
        }
        const searchParams = request.nextUrl.searchParams;
        const page = Math.max(
            1,
            parseInt(searchParams.get("page") || "1") || 1,
        );
        const limit = Math.min(
            500,
            Math.max(1, parseInt(searchParams.get("limit") || "50") || 50),
        );
        const search = (searchParams.get("search") || "").slice(0, 100).trim();
        const category = (searchParams.get("category") || "").trim();
        const status = searchParams.get("status") || "all";
        const sort = searchParams.get("sort") || "createdAt";
        const order = searchParams.get("order") === "asc" ? "asc" : "desc";
        const skip = (page - 1) * limit;

        const where: Prisma.ProductWhereInput = {};
        if (search)
            where.OR = [{ name: { contains: search, mode: "insensitive" } }];
        if (category) where.category = category;
        if (status === "active") where.active = true;
        else if (status === "inactive") where.active = false;

        const orderBy: Prisma.ProductOrderByWithRelationInput =
            sort === "price"
                ? { price: order }
                : sort === "name"
                  ? { name: order }
                  : { createdAt: order };

        const [products, total, categoryRows] = await Promise.all([
            prisma.product.findMany({
                where,
                orderBy,
                skip,
                take: limit,
            }),
            prisma.product.count({ where }),
            prisma.product.findMany({
                distinct: ["category"],
                select: { category: true },
                orderBy: { category: "asc" },
            }),
        ]);

        return NextResponse.json({
            products,
            categories: categoryRows.map((row) => row.category),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error("Failed to fetch products:", error);
        return NextResponse.json(
            { error: "Failed to fetch products" },
            { status: 500 },
        );
    }
});

// POST /api/admin/products - 产品创建已收敛到主站同步
export async function POST() {
    return NextResponse.json(
        { error: "产品由主站同步创建" },
        { status: 405 },
    );
}
