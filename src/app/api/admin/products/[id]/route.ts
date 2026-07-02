import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth, requireRole, getClientInfo } from "@/lib/admin-auth";
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
} from "@/types/product";

// GET /api/admin/products/[id] - Get product details
// Available to super_admin and admin
export const GET = withAdminAuth(async (
    request: NextRequest,
    { params }
) => {
    try {
        const { id } = await params;
        const product = await prisma.product.findUnique({
            where: { id }
        });
        if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(product);
    } catch (error) {
        console.error("Failed to fetch product:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
});

// PUT /api/admin/products/[id] - Update product
// Available to super_admin and admin
export const PUT = withAdminAuth(async (
    request: NextRequest,
    { admin, params }
) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-product-update-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const { id } = await params;
        const body = await request.json();
        const clientInfo = getClientInfo(request);

        // Build update data — only include fields that are explicitly provided
        const allowedFields = [
            'name', 'category', 'image', 'images', 'price', 'description',
            'keyIngredients', 'suitableSkinTypes', 'benefits', 'negativeFor',
            'active', 'featured', 'howToUse',
            'affiliateLinks'
        ];

        const updateData: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400 }
            );
        }

        // Validate string fields
        if (updateData.name !== undefined && (typeof updateData.name !== "string" || updateData.name.trim().length === 0 || updateData.name.length > MAX_NAME_LENGTH)) {
            return NextResponse.json({ error: `Invalid name (max ${MAX_NAME_LENGTH} chars)` }, { status: 400 });
        }
        if (updateData.category !== undefined && (typeof updateData.category !== "string" || updateData.category.trim().length === 0 || updateData.category.length > MAX_CATEGORY_LENGTH)) {
            return NextResponse.json({ error: `Invalid category (max ${MAX_CATEGORY_LENGTH} chars)` }, { status: 400 });
        }
        if (updateData.image !== undefined && (typeof updateData.image !== "string" || updateData.image.length > MAX_IMAGE_URL_LENGTH)) {
            return NextResponse.json({ error: `Invalid image URL (max ${MAX_IMAGE_URL_LENGTH} chars)` }, { status: 400 });
        }
        if (updateData.image !== undefined) {
            const isAbsoluteUrl = /^https?:\/\//.test(updateData.image as string);
            const isRelativePath = (updateData.image as string).startsWith("/");
            if (!isAbsoluteUrl && !isRelativePath) {
                return NextResponse.json({ error: "Invalid image URL format (must be absolute URL or relative path starting with /)" }, { status: 400 });
            }
            if (isAbsoluteUrl) {
                try {
                    const imageUrl = new URL(updateData.image as string);
                    if (!['http:', 'https:'].includes(imageUrl.protocol)) {
                        return NextResponse.json({ error: "Invalid image URL scheme (must be http or https)" }, { status: 400 });
                    }
                } catch {
                    return NextResponse.json({ error: "Invalid image URL format" }, { status: 400 });
                }
            }
        }

        // description 字段在 schema 中为 String（非 null），拒绝 null 值
        if (updateData.description === null) {
            return NextResponse.json({ error: "Description cannot be null" }, { status: 400 });
        }
        if (updateData.description !== undefined && updateData.description !== null && (typeof updateData.description !== "string" || updateData.description.trim().length === 0 || updateData.description.length > MAX_DESCRIPTION_LENGTH)) {
            return NextResponse.json({ error: `Invalid description (required when provided, max ${MAX_DESCRIPTION_LENGTH} chars)` }, { status: 400 });
        }

        // price 字段在 schema 中为 String（非 null），拒绝 null 值
        if (updateData.price === null) {
            return NextResponse.json({ error: "Price cannot be null" }, { status: 400 });
        }
        if (updateData.price !== undefined && (typeof updateData.price !== "string" || updateData.price.trim().length === 0 || updateData.price.length > MAX_PRICE_LENGTH)) {
            return NextResponse.json({ error: `Invalid price (required when provided, max ${MAX_PRICE_LENGTH} chars)` }, { status: 400 });
        }

        // howToUse 字段在 schema 中为 String?，校验类型与长度
        if (updateData.howToUse === null) {
            updateData.howToUse = null;
        } else if (updateData.howToUse !== undefined) {
            if (typeof updateData.howToUse !== "string" || updateData.howToUse.length > MAX_HOW_TO_USE_LENGTH) {
                return NextResponse.json({ error: `Invalid howToUse (must be a string, max ${MAX_HOW_TO_USE_LENGTH} chars)` }, { status: 400 });
            }
        }

        // Validate array fields
        if (updateData.images !== undefined && updateData.images !== null) {
            if (!Array.isArray(updateData.images) || updateData.images.length > MAX_IMAGE_COUNT) {
                return NextResponse.json({ error: `images must be an array with at most ${MAX_IMAGE_COUNT} items` }, { status: 400 });
            }
            if (!updateData.images.every((img: unknown) => typeof img === "string" && (img as string).length <= MAX_IMAGE_URL_LENGTH)) {
                return NextResponse.json({ error: `Each image must be a string URL (max ${MAX_IMAGE_URL_LENGTH} chars)` }, { status: 400 });
            }
            for (const img of updateData.images) {
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

        // Validate JSON string array fields
        const validateStringArray = (value: unknown, _fieldName: string) => {
            if (value === undefined || value === null) return true;
            if (!Array.isArray(value)) return false;
            if (value.length > MAX_TAG_ARRAY_LENGTH) return false;
            return value.every((item) => typeof item === "string" && item.length <= MAX_TAG_ITEM_LENGTH);
        };

        if (!validateStringArray(updateData.keyIngredients, "keyIngredients")) {
            return NextResponse.json({ error: `keyIngredients must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)` }, { status: 400 });
        }
        if (!validateStringArray(updateData.suitableSkinTypes, "suitableSkinTypes")) {
            return NextResponse.json({ error: `suitableSkinTypes must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)` }, { status: 400 });
        }
        if (!validateStringArray(updateData.benefits, "benefits")) {
            return NextResponse.json({ error: `benefits must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)` }, { status: 400 });
        }
        if (!validateStringArray(updateData.negativeFor, "negativeFor")) {
            return NextResponse.json({ error: `negativeFor must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)` }, { status: 400 });
        }

        // Validate affiliateLinks
        if (updateData.affiliateLinks !== undefined && updateData.affiliateLinks !== null) {
            if (typeof updateData.affiliateLinks !== "object" || Array.isArray(updateData.affiliateLinks)) {
                return NextResponse.json({ error: "affiliateLinks must be an object" }, { status: 400 });
            }
            const links = updateData.affiliateLinks as Record<string, unknown>;
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

        // Validate boolean fields
        if (updateData.active !== undefined) {
            updateData.active = updateData.active === true;
        }
        if (updateData.featured !== undefined) {
            updateData.featured = updateData.featured === true;
        }

        // Trim string fields before persistence
        if (typeof updateData.name === "string") updateData.name = updateData.name.trim();
        if (typeof updateData.category === "string") updateData.category = updateData.category.trim();
        if (typeof updateData.description === "string") updateData.description = updateData.description.trim();
        if (typeof updateData.price === "string") updateData.price = updateData.price.trim();
        if (typeof updateData.howToUse === "string") updateData.howToUse = updateData.howToUse.trim();

        const txResult = await prisma.$transaction(async (tx) => {
            const oldProduct = await tx.product.findUnique({ where: { id } });
            if (!oldProduct) {
                return { type: "not_found" as const };
            }

            const product = await tx.product.update({
                where: { id },
                data: updateData
            });

            await tx.adminAuditLog.create({
                data: {
                    adminId: admin.adminId,
                    action: "update",
                    resource: "Product",
                    resourceId: id,
                    details: {
                        oldName: oldProduct.name,
                        newName: updateData.name || oldProduct.name,
                        changes: Object.keys(updateData)
                    },
                    ip: clientInfo.ip,
                    userAgent: clientInfo.userAgent,
                }
            });

            return { type: "success" as const, product };
        });

        if (txResult.type === "not_found") {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        return NextResponse.json(txResult.product);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
});

// DELETE /api/admin/products/[id] - Delete product
// Available to super_admin and admin
export const DELETE = requireRole("super_admin", "admin")(async (
    request: NextRequest,
    { admin, params }
) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-product-delete-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const { id } = await params;
        const clientInfo = getClientInfo(request);

        await prisma.$transaction(async (tx) => {
            const product = await tx.product.findUnique({ where: { id } });
            if (!product) {
                throw new Error("NOT_FOUND");
            }

            await tx.product.delete({ where: { id } });
            // Junction table records are automatically cleaned up via onDelete: Cascade

            await tx.adminAuditLog.create({
                data: {
                    adminId: admin.adminId,
                    action: "delete",
                    resource: "Product",
                    resourceId: id,
                    details: { name: product.name },
                    ip: clientInfo.ip,
                    userAgent: clientInfo.userAgent,
                }
            });
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === "NOT_FOUND") {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }
        console.error("Failed to delete product:", error);
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
});
