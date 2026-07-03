import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import {
    MAX_NAME_LENGTH,
    MAX_CATEGORY_LENGTH,
    MAX_PRICE_LENGTH,
    MAX_DESCRIPTION_LENGTH,
    MAX_HOW_TO_USE_LENGTH,
    MAX_IMAGE_URL_LENGTH,
    MAX_AFFILIATE_URL_LENGTH,
    MAX_IMAGE_COUNT,
    MAX_TAG_ITEM_LENGTH,
    MAX_TAG_ARRAY_LENGTH,
    AFFILIATE_PLATFORM_KEYS,
    validateImageUrl,
} from "@/types/product";

// GET /api/admin/products - List products with pagination
// Available to super_admin and admin
export const GET = withAdminAuth(async (request: NextRequest) => {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
        const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.product.count(),
        ]);

        return NextResponse.json({
            products,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        });
    } catch (error) {
        console.error("Failed to fetch products:", error);
        return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
    }
});

// POST /api/admin/products - Create a new product
// Available to super_admin and admin
export const POST = withAdminAuth(async (request, { admin }) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-product-create-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const body = await request.json();
        const clientInfo = { ip: getClientIP(request), userAgent: request.headers.get("user-agent") || "unknown" };

        // Validate required string fields
        if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0 || body.name.length > MAX_NAME_LENGTH) {
            return NextResponse.json({ error: `Invalid name (required, max ${MAX_NAME_LENGTH} chars)` }, { status: 400 });
        }
        if (!body.category || typeof body.category !== "string" || body.category.trim().length === 0 || body.category.length > MAX_CATEGORY_LENGTH) {
            return NextResponse.json({ error: `Invalid category (required, max ${MAX_CATEGORY_LENGTH} chars)` }, { status: 400 });
        }
        if (!body.image || typeof body.image !== "string" || body.image.length > MAX_IMAGE_URL_LENGTH) {
            return NextResponse.json({ error: `Invalid image URL (required, max ${MAX_IMAGE_URL_LENGTH} chars)` }, { status: 400 });
        }
        const imageError = validateImageUrl(body.image);
        if (imageError) return NextResponse.json({ error: imageError }, { status: 400 });

        if (body.price === undefined || body.price === null || typeof body.price !== "string" || body.price.trim().length === 0 || body.price.length > MAX_PRICE_LENGTH) {
            return NextResponse.json({ error: `Invalid price (required, max ${MAX_PRICE_LENGTH} chars)` }, { status: 400 });
        }

        if (!body.description || typeof body.description !== "string" || body.description.trim().length === 0 || body.description.length > MAX_DESCRIPTION_LENGTH) {
            return NextResponse.json({ error: `Invalid description (required, max ${MAX_DESCRIPTION_LENGTH} chars)` }, { status: 400 });
        }

        if (body.howToUse !== undefined && body.howToUse !== null) {
            if (typeof body.howToUse !== "string" || body.howToUse.length > MAX_HOW_TO_USE_LENGTH) {
                return NextResponse.json({ error: `Invalid howToUse (must be a string, max ${MAX_HOW_TO_USE_LENGTH} chars)` }, { status: 400 });
            }
        }

        // Validate images array
        if (body.images !== undefined && body.images !== null) {
            if (!Array.isArray(body.images) || body.images.length > MAX_IMAGE_COUNT) {
                return NextResponse.json({ error: `images must be an array with at most ${MAX_IMAGE_COUNT} items` }, { status: 400 });
            }
            if (!body.images.every((img: unknown) => typeof img === "string" && (img as string).length <= MAX_IMAGE_URL_LENGTH)) {
                return NextResponse.json({ error: `Each image must be a string URL (max ${MAX_IMAGE_URL_LENGTH} chars)` }, { status: 400 });
            }
            for (const img of body.images) {
                const imgStr = img as string;
                const isAbsolute = /^https?:\/\//.test(imgStr);
                const isRelative = imgStr.startsWith("/");
                if (!isAbsolute && !isRelative) {
                    return NextResponse.json({ error: `Invalid image URL format: "${imgStr}" (must be absolute URL or relative path starting with /)` }, { status: 400 });
                }
                if (isAbsolute) {
                    try {
                        const imgUrl = new URL(imgStr);
                        if (!['http:', 'https:'].includes(imgUrl.protocol)) {
                            return NextResponse.json({ error: "Invalid image URL scheme (must be http or https)" }, { status: 400 });
                        }
                    } catch {
                        return NextResponse.json({ error: "Invalid image URL format" }, { status: 400 });
                    }
                }
            }
        }

        // Validate string array JSON fields
        const validateStringArray = (value: unknown, _fieldName: string) => {
            if (value === undefined || value === null) return true;
            if (!Array.isArray(value)) return false;
            if (value.length > MAX_TAG_ARRAY_LENGTH) return false;
            return value.every((item) => typeof item === "string" && item.length <= MAX_TAG_ITEM_LENGTH);
        };

        if (!validateStringArray(body.keyIngredients, "keyIngredients")) {
            return NextResponse.json({ error: `keyIngredients must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)` }, { status: 400 });
        }
        if (!validateStringArray(body.suitableSkinTypes, "suitableSkinTypes")) {
            return NextResponse.json({ error: `suitableSkinTypes must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)` }, { status: 400 });
        }
        if (!validateStringArray(body.benefits, "benefits")) {
            return NextResponse.json({ error: `benefits must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)` }, { status: 400 });
        }
        if (!validateStringArray(body.negativeFor, "negativeFor")) {
            return NextResponse.json({ error: `negativeFor must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)` }, { status: 400 });
        }

        // Validate affiliateLinks values are valid URLs and only known keys
        if (body.affiliateLinks !== undefined && body.affiliateLinks !== null) {
            if (typeof body.affiliateLinks !== "object" || Array.isArray(body.affiliateLinks)) {
                return NextResponse.json({ error: "affiliateLinks must be an object" }, { status: 400 });
            }
            const links = body.affiliateLinks as Record<string, unknown>;
            for (const key of Object.keys(links)) {
                if (!AFFILIATE_PLATFORM_KEYS.includes(key as typeof AFFILIATE_PLATFORM_KEYS[number])) {
                    return NextResponse.json({ error: `affiliateLinks key "${key}" is not allowed` }, { status: 400 });
                }
            }
            for (const [key, value] of Object.entries(links)) {
                if (typeof value !== "string" || value.length > MAX_AFFILIATE_URL_LENGTH) {
                    return NextResponse.json({ error: `Invalid affiliateLinks.${key} (must be a string URL, max ${MAX_AFFILIATE_URL_LENGTH} chars)` }, { status: 400 });
                }
                if (value) {
                    try {
                        const url = new URL(value);
                        if (!['http:', 'https:'].includes(url.protocol)) {
                            return NextResponse.json({ error: `Invalid affiliateLinks.${key} scheme (must be http or https)` }, { status: 400 });
                        }
                    } catch {
                        return NextResponse.json({ error: `Invalid affiliateLinks.${key} format` }, { status: 400 });
                    }
                }
            }
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
                    affiliateLinks: body.affiliateLinks || null,
                    featured: body.featured === true,
                }
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
                }
            });

            return [product];
        });

        return NextResponse.json(product);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
    }
});
