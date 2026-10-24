import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { withAdminAuth } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import {
    MAX_NAME_LENGTH,
    MAX_CATEGORY_LENGTH,
    MAX_PRICE_LENGTH,
    MAX_DESCRIPTION_LENGTH,
    MAX_HOW_TO_USE_LENGTH,
    MAX_ORIGIN_LENGTH,
    MAX_CAPACITY_LENGTH,
    MAX_IMAGE_URL_LENGTH,
    MAX_AFFILIATE_URL_LENGTH,
    MAX_IMAGE_COUNT,
    MAX_TAG_ITEM_LENGTH,
    MAX_TAG_ARRAY_LENGTH,
    AFFILIATE_PLATFORM_KEYS,
    validateImageUrl,
    recommendReasonsSchema,
    purchaseLinksSchema,
} from "@/types/product";
import {
    buildAffiliateLinks,
    normalizeProductPurchaseLinks,
} from "@/lib/product-links";
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

// POST /api/admin/products - Create a new product
// Available to super_admin and admin
export const POST = withAdminAuth(async (request, { admin }) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(
        `admin-product-create-${ip}`,
        "default",
        {
            maxRequests: 30,
            windowMs: 60 * 1000,
        },
    );
    if (!limitResult.success) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429 },
        );
    }

    try {
        const body = await request.json();
        const clientInfo = {
            ip: getClientIP(request),
            userAgent: request.headers.get("user-agent") || "unknown",
        };

        // Validate required string fields
        if (
            !body.name ||
            typeof body.name !== "string" ||
            body.name.trim().length === 0 ||
            body.name.length > MAX_NAME_LENGTH
        ) {
            return NextResponse.json(
                {
                    error: `Invalid name (required, max ${MAX_NAME_LENGTH} chars)`,
                },
                { status: 400 },
            );
        }
        if (
            !body.category ||
            typeof body.category !== "string" ||
            body.category.trim().length === 0 ||
            body.category.length > MAX_CATEGORY_LENGTH
        ) {
            return NextResponse.json(
                {
                    error: `Invalid category (required, max ${MAX_CATEGORY_LENGTH} chars)`,
                },
                { status: 400 },
            );
        }
        if (
            !body.image ||
            typeof body.image !== "string" ||
            body.image.length > MAX_IMAGE_URL_LENGTH
        ) {
            return NextResponse.json(
                {
                    error: `Invalid image URL (required, max ${MAX_IMAGE_URL_LENGTH} chars)`,
                },
                { status: 400 },
            );
        }
        const imageError = validateImageUrl(body.image);
        if (imageError)
            return NextResponse.json({ error: imageError }, { status: 400 });

        if (
            body.price === undefined ||
            body.price === null ||
            typeof body.price !== "string" ||
            body.price.trim().length === 0 ||
            body.price.length > MAX_PRICE_LENGTH
        ) {
            return NextResponse.json(
                {
                    error: `Invalid price (required, max ${MAX_PRICE_LENGTH} chars)`,
                },
                { status: 400 },
            );
        }

        if (
            !body.description ||
            typeof body.description !== "string" ||
            body.description.trim().length === 0 ||
            body.description.length > MAX_DESCRIPTION_LENGTH
        ) {
            return NextResponse.json(
                {
                    error: `Invalid description (required, max ${MAX_DESCRIPTION_LENGTH} chars)`,
                },
                { status: 400 },
            );
        }

        if (body.howToUse !== undefined && body.howToUse !== null) {
            if (
                typeof body.howToUse !== "string" ||
                body.howToUse.length > MAX_HOW_TO_USE_LENGTH
            ) {
                return NextResponse.json(
                    {
                        error: `Invalid howToUse (must be a string, max ${MAX_HOW_TO_USE_LENGTH} chars)`,
                    },
                    { status: 400 },
                );
            }
        }

        if (body.origin !== undefined && body.origin !== null) {
            if (
                typeof body.origin !== "string" ||
                body.origin.length > MAX_ORIGIN_LENGTH
            ) {
                return NextResponse.json(
                    {
                        error: `Invalid origin (must be a string, max ${MAX_ORIGIN_LENGTH} chars)`,
                    },
                    { status: 400 },
                );
            }
        }
        if (body.capacity !== undefined && body.capacity !== null) {
            if (
                typeof body.capacity !== "string" ||
                body.capacity.length > MAX_CAPACITY_LENGTH
            ) {
                return NextResponse.json(
                    {
                        error: `Invalid capacity (must be a string, max ${MAX_CAPACITY_LENGTH} chars)`,
                    },
                    { status: 400 },
                );
            }
        }

        // Validate images array
        if (body.images !== undefined && body.images !== null) {
            if (
                !Array.isArray(body.images) ||
                body.images.length > MAX_IMAGE_COUNT
            ) {
                return NextResponse.json(
                    {
                        error: `images must be an array with at most ${MAX_IMAGE_COUNT} items`,
                    },
                    { status: 400 },
                );
            }
            if (
                !body.images.every(
                    (img: unknown) =>
                        typeof img === "string" &&
                        (img as string).length <= MAX_IMAGE_URL_LENGTH,
                )
            ) {
                return NextResponse.json(
                    {
                        error: `Each image must be a string URL (max ${MAX_IMAGE_URL_LENGTH} chars)`,
                    },
                    { status: 400 },
                );
            }
            for (const img of body.images) {
                const imgStr = img as string;
                const isAbsolute = /^https?:\/\//.test(imgStr);
                const isRelative = imgStr.startsWith("/");
                if (!isAbsolute && !isRelative) {
                    return NextResponse.json(
                        {
                            error: `Invalid image URL format: "${imgStr}" (must be absolute URL or relative path starting with /)`,
                        },
                        { status: 400 },
                    );
                }
                if (isAbsolute) {
                    try {
                        const imgUrl = new URL(imgStr);
                        if (!["http:", "https:"].includes(imgUrl.protocol)) {
                            return NextResponse.json(
                                {
                                    error: "Invalid image URL scheme (must be http or https)",
                                },
                                { status: 400 },
                            );
                        }
                    } catch {
                        return NextResponse.json(
                            { error: "Invalid image URL format" },
                            { status: 400 },
                        );
                    }
                }
            }
        }

        // Validate string array JSON fields
        const validateStringArray = (value: unknown) => {
            if (value === undefined || value === null) return true;
            if (!Array.isArray(value)) return false;
            if (value.length > MAX_TAG_ARRAY_LENGTH) return false;
            return value.every(
                (item) =>
                    typeof item === "string" &&
                    item.length <= MAX_TAG_ITEM_LENGTH,
            );
        };

        if (!validateStringArray(body.keyIngredients)) {
            return NextResponse.json(
                {
                    error: `keyIngredients must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)`,
                },
                { status: 400 },
            );
        }
        if (!validateStringArray(body.suitableSkinTypes)) {
            return NextResponse.json(
                {
                    error: `suitableSkinTypes must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)`,
                },
                { status: 400 },
            );
        }
        if (!validateStringArray(body.benefits)) {
            return NextResponse.json(
                {
                    error: `benefits must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)`,
                },
                { status: 400 },
            );
        }
        if (!validateStringArray(body.negativeFor)) {
            return NextResponse.json(
                {
                    error: `negativeFor must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)`,
                },
                { status: 400 },
            );
        }

        if (
            body.recommendReasons !== undefined &&
            body.recommendReasons !== null
        ) {
            const parsedReasons = recommendReasonsSchema.safeParse(
                body.recommendReasons,
            );
            if (!parsedReasons.success) {
                return NextResponse.json(
                    { error: "Invalid recommendReasons format" },
                    { status: 400 },
                );
            }
        }

        // Validate affiliateLinks values are valid URLs and only known keys
        // purchaseLinks 存在时旧字段仅作为派生结果，忽略客户端直接提交值。
        if (
            body.purchaseLinks === undefined &&
            body.affiliateLinks !== undefined &&
            body.affiliateLinks !== null
        ) {
            if (
                typeof body.affiliateLinks !== "object" ||
                Array.isArray(body.affiliateLinks)
            ) {
                return NextResponse.json(
                    { error: "affiliateLinks must be an object" },
                    { status: 400 },
                );
            }
            const links = body.affiliateLinks as Record<string, unknown>;
            for (const key of Object.keys(links)) {
                if (
                    !AFFILIATE_PLATFORM_KEYS.includes(
                        key as (typeof AFFILIATE_PLATFORM_KEYS)[number],
                    )
                ) {
                    return NextResponse.json(
                        { error: `affiliateLinks key "${key}" is not allowed` },
                        { status: 400 },
                    );
                }
            }
            for (const [key, value] of Object.entries(links)) {
                if (
                    typeof value !== "string" ||
                    value.length > MAX_AFFILIATE_URL_LENGTH
                ) {
                    return NextResponse.json(
                        {
                            error: `Invalid affiliateLinks.${key} (must be a string URL, max ${MAX_AFFILIATE_URL_LENGTH} chars)`,
                        },
                        { status: 400 },
                    );
                }
                if (value) {
                    try {
                        const url = new URL(value);
                        if (!["http:", "https:"].includes(url.protocol)) {
                            return NextResponse.json(
                                {
                                    error: `Invalid affiliateLinks.${key} scheme (must be http or https)`,
                                },
                                { status: 400 },
                            );
                        }
                    } catch {
                        return NextResponse.json(
                            { error: `Invalid affiliateLinks.${key} format` },
                            { status: 400 },
                        );
                    }
                }
            }
        }

        let purchaseLinks = body.purchaseLinks;
        if (purchaseLinks !== undefined && purchaseLinks !== null) {
            const parsedLinks = purchaseLinksSchema.safeParse(purchaseLinks);
            if (!parsedLinks.success) {
                return NextResponse.json(
                    {
                        error:
                            parsedLinks.error.issues[0]?.message ||
                            "Invalid purchaseLinks",
                    },
                    { status: 400 },
                );
            }
            purchaseLinks = parsedLinks.data?.length ? parsedLinks.data : null;
        }

        const [product] = await prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: {
                    name: body.name.trim(),
                    category: body.category.trim(),
                    image: body.image.trim(),
                    images: body.images || null,
                    price: body.price.trim(),
                    description: body.description.trim(),
                    keyIngredients: body.keyIngredients || [],
                    suitableSkinTypes: body.suitableSkinTypes || [],
                    benefits: body.benefits || [],
                    negativeFor: body.negativeFor || [],
                    active: body.active === true,
                    howToUse: body.howToUse || null,
                    origin:
                        typeof body.origin === "string"
                            ? body.origin.trim() || null
                            : null,
                    capacity:
                        typeof body.capacity === "string"
                            ? body.capacity.trim() || null
                            : null,
                    purchaseLinks: purchaseLinks ?? null,
                    // 新版以 purchaseLinks 为准，始终派生旧字段；仅旧客户端未传新结构时保留 affiliateLinks。
                    affiliateLinks:
                        body.purchaseLinks !== undefined
                            ? buildAffiliateLinks(
                                  normalizeProductPurchaseLinks(
                                      purchaseLinks,
                                      null,
                                  ),
                              )
                            : body.affiliateLinks || null,
                    featured: body.featured === true,
                    recommendReasons: body.recommendReasons || null,
                },
            });

            await tx.adminAuditLog.create({
                data: {
                    adminId: admin.adminId,
                    action: "create",
                    resource: "Product",
                    resourceId: product.id,
                    details: { name: product.name, category: product.category },
                    ip: clientInfo.ip,
                    userAgent: clientInfo.userAgent,
                },
            });

            return [product];
        });

        return NextResponse.json(product);
    } catch (error) {
        logger.error("Failed to create product", error);
        return NextResponse.json(
            { error: "Failed to create product" },
            { status: 500 },
        );
    }
});
