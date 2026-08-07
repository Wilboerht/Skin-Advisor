import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import prisma from "@/lib/prisma";
import { withAdminAuth, requireRole, getClientInfo } from "@/lib/admin-auth";
import { AdminRole } from "@/lib/permissions";
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
import { logger } from "@/lib/logger";

// GET /api/admin/products/[id] - Get product details
// Available to super_admin and admin
export const GET = withAdminAuth(async (
    request: NextRequest,
    { params }
) => {
    try {
        const ip = getClientIP(request);
        const rc = await rateLimit(`admin-products-get-${ip}`, "default", { maxRequests: 60, windowMs: 60 * 1000 });
        if (!rc.success) {
            return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });
        }
        const { id } = await params;
        const product = await prisma.product.findUnique({
            where: { id }
        });
        if (!product) return apiError(ErrorCode.NOT_FOUND, "Not found", 404);
        return NextResponse.json(product);
    } catch (error) {
        logger.error("Failed to fetch product:", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "Internal Error", 500);
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
        return apiError(ErrorCode.RATE_LIMITED, "Too many requests", 429);
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
            'affiliateLinks', 'recommendReasons'
        ];

        const updateData: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return apiError(ErrorCode.VALIDATION_ERROR, "No valid fields to update", 400);
        }

        // Validate string fields
        if (updateData.name !== undefined && (typeof updateData.name !== "string" || updateData.name.trim().length === 0 || updateData.name.length > MAX_NAME_LENGTH)) {
            return apiError(ErrorCode.VALIDATION_ERROR, `Invalid name (max ${MAX_NAME_LENGTH} chars)`, 400);
        }
        if (updateData.category !== undefined && (typeof updateData.category !== "string" || updateData.category.trim().length === 0 || updateData.category.length > MAX_CATEGORY_LENGTH)) {
            return apiError(ErrorCode.VALIDATION_ERROR, `Invalid category (max ${MAX_CATEGORY_LENGTH} chars)`, 400);
        }
        if (updateData.image !== undefined && (typeof updateData.image !== "string" || updateData.image.length > MAX_IMAGE_URL_LENGTH)) {
            return apiError(ErrorCode.VALIDATION_ERROR, `Invalid image URL (max ${MAX_IMAGE_URL_LENGTH} chars)`, 400);
        }
        if (updateData.image !== undefined) {
            const imageError = validateImageUrl(updateData.image as string);
            if (imageError) return apiError(ErrorCode.VALIDATION_ERROR, imageError, 400);
        }

        // description 字段在 schema 中为 String（非 null），拒绝 null 值
        if (updateData.description === null) {
            return apiError(ErrorCode.VALIDATION_ERROR, "Description cannot be null", 400);
        }
        if (updateData.description !== undefined && updateData.description !== null && (typeof updateData.description !== "string" || updateData.description.trim().length === 0 || updateData.description.length > MAX_DESCRIPTION_LENGTH)) {
            return apiError(ErrorCode.VALIDATION_ERROR, `Invalid description (required when provided, max ${MAX_DESCRIPTION_LENGTH} chars)`, 400);
        }

        // price 字段在 schema 中为 String（非 null），拒绝 null 值
        if (updateData.price === null) {
            return apiError(ErrorCode.VALIDATION_ERROR, "Price cannot be null", 400);
        }
        if (updateData.price !== undefined && (typeof updateData.price !== "string" || updateData.price.trim().length === 0 || updateData.price.length > MAX_PRICE_LENGTH)) {
            return apiError(ErrorCode.VALIDATION_ERROR, `Invalid price (required when provided, max ${MAX_PRICE_LENGTH} chars)`, 400);
        }

        // howToUse 字段在 schema 中为 String?，校验类型与长度
        if (updateData.howToUse === null) {
            updateData.howToUse = null;
        } else if (updateData.howToUse !== undefined) {
            if (typeof updateData.howToUse !== "string" || updateData.howToUse.length > MAX_HOW_TO_USE_LENGTH) {
                return apiError(ErrorCode.VALIDATION_ERROR, `Invalid howToUse (must be a string, max ${MAX_HOW_TO_USE_LENGTH} chars)`, 400);
            }
        }

        // Validate array fields
        if (updateData.images !== undefined && updateData.images !== null) {
            if (!Array.isArray(updateData.images) || updateData.images.length > MAX_IMAGE_COUNT) {
                return apiError(ErrorCode.VALIDATION_ERROR, `images must be an array with at most ${MAX_IMAGE_COUNT} items`, 400);
            }
            if (!updateData.images.every((img: unknown) => typeof img === "string" && (img as string).length <= MAX_IMAGE_URL_LENGTH)) {
                return apiError(ErrorCode.VALIDATION_ERROR, `Each image must be a string URL (max ${MAX_IMAGE_URL_LENGTH} chars)`, 400);
            }
            for (const img of updateData.images) {
                const imgStr = img as string;
                const isAbsolute = /^https?:\/\//.test(imgStr);
                const isRelative = imgStr.startsWith("/");
                if (!isAbsolute && !isRelative) {
                    return apiError(ErrorCode.VALIDATION_ERROR, `Invalid image URL format: "${imgStr}" (must be absolute URL or relative path starting with /)`, 400);
                }
                if (isAbsolute) {
                    try {
                        const imgUrl = new URL(imgStr);
                        if (!['http:', 'https:'].includes(imgUrl.protocol)) {
                            return apiError(ErrorCode.VALIDATION_ERROR, "Invalid image URL scheme (must be http or https)", 400);
                        }
                    } catch {
                        return apiError(ErrorCode.VALIDATION_ERROR, "Invalid image URL format", 400);
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
            return apiError(ErrorCode.VALIDATION_ERROR, `keyIngredients must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)`, 400);
        }
        if (!validateStringArray(updateData.suitableSkinTypes, "suitableSkinTypes")) {
            return apiError(ErrorCode.VALIDATION_ERROR, `suitableSkinTypes must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)`, 400);
        }
        if (!validateStringArray(updateData.benefits, "benefits")) {
            return apiError(ErrorCode.VALIDATION_ERROR, `benefits must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)`, 400);
        }
        if (!validateStringArray(updateData.negativeFor, "negativeFor")) {
            return apiError(ErrorCode.VALIDATION_ERROR, `negativeFor must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)`, 400);
        }

        // Validate affiliateLinks
        if (updateData.affiliateLinks !== undefined && updateData.affiliateLinks !== null) {
            if (typeof updateData.affiliateLinks !== "object" || Array.isArray(updateData.affiliateLinks)) {
                return apiError(ErrorCode.VALIDATION_ERROR, "affiliateLinks must be an object", 400);
            }
            const links = updateData.affiliateLinks as Record<string, unknown>;
            for (const key of Object.keys(links)) {
                if (!AFFILIATE_PLATFORM_KEYS.includes(key as typeof AFFILIATE_PLATFORM_KEYS[number])) {
                    return apiError(ErrorCode.VALIDATION_ERROR, `affiliateLinks key "${key}" is not allowed`, 400);
                }
            }
            for (const [key, value] of Object.entries(links)) {
                if (typeof value !== "string" || value.length > MAX_AFFILIATE_URL_LENGTH) {
                    return apiError(ErrorCode.VALIDATION_ERROR, `Invalid affiliateLinks.${key} (must be a string URL, max ${MAX_AFFILIATE_URL_LENGTH} chars)`, 400);
                }
                if (value) {
                    try {
                        const url = new URL(value);
                        if (!['http:', 'https:'].includes(url.protocol)) {
                            return apiError(ErrorCode.VALIDATION_ERROR, `Invalid affiliateLinks.${key} scheme (must be http or https)`, 400);
                        }
                    } catch {
                        return apiError(ErrorCode.VALIDATION_ERROR, `Invalid affiliateLinks.${key} format`, 400);
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
            return apiError(ErrorCode.NOT_FOUND, "Product not found", 404);
        }

        revalidateTag("admin-stats", "max");
        return NextResponse.json(txResult.product);
    } catch (error) {
        logger.error("Failed to update product", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "Failed to update", 500);
    }
});

// DELETE /api/admin/products/[id] - Delete product
// Available to super_admin and admin
export const DELETE = requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)(async (
    request: NextRequest,
    { admin, params }
) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-product-delete-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return apiError(ErrorCode.RATE_LIMITED, "Too many requests", 429);
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

        revalidateTag("admin-stats", "max");
        return apiSuccess();
    } catch (error: unknown) {
        if (error instanceof Error && error.message === "NOT_FOUND") {
            return apiError(ErrorCode.NOT_FOUND, "Product not found", 404);
        }
        logger.error("Failed to delete product:", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "Failed to delete", 500);
    }
});
