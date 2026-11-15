import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import prisma from "@/lib/prisma";
import { invalidateActiveProductsCache } from "@/lib/product-cache";
import { withAdminAuth, requireRole, getClientInfo } from "@/lib/admin-auth";
import { AdminRole } from "@/lib/permissions";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import {
    MAX_TAG_ITEM_LENGTH,
    MAX_TAG_ARRAY_LENGTH,
    recommendReasonsSchema,
} from "@/types/product";
import { deleteUnreferencedProductAssets, productImageRefs } from "@/lib/product-assets";
import { logger } from "@/lib/logger";

/** 基础字段只能由主站同步，子站管理端一律忽略写入 */
const SYNCED_SHARED_FIELDS = [
    "name",
    "category",
    "image",
    "images",
    "price",
    "description",
    "howToUse",
    "origin",
    "capacity",
    "affiliateLinks",
    "purchaseLinks",
] as const;

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
        const body = (await request.json()) as Record<string, unknown>;
        // 基础信息只由主站同步写入，任何产品的 PUT 都忽略这些字段
        for (const field of SYNCED_SHARED_FIELDS) {
            delete body[field];
        }
        const clientInfo = getClientInfo(request);

        // Build update data — only include sub-site fields that are explicitly provided
        const allowedFields = [
            'keyIngredients', 'suitableSkinTypes', 'benefits', 'negativeFor',
            'active', 'featured', 'recommendReasons'
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

        // Validate JSON string array fields（这些字段在 schema 中非空，只允许省略，不允许 null）
        const validateStringArray = (value: unknown) => {
            if (value === undefined) return true;
            if (!Array.isArray(value)) return false;
            if (value.length > MAX_TAG_ARRAY_LENGTH) return false;
            return value.every((item) => typeof item === "string" && item.length <= MAX_TAG_ITEM_LENGTH);
        };

        if (!validateStringArray(updateData.keyIngredients)) {
            return apiError(ErrorCode.VALIDATION_ERROR, `keyIngredients must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)`, 400);
        }
        if (!validateStringArray(updateData.suitableSkinTypes)) {
            return apiError(ErrorCode.VALIDATION_ERROR, `suitableSkinTypes must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)`, 400);
        }
        if (!validateStringArray(updateData.benefits)) {
            return apiError(ErrorCode.VALIDATION_ERROR, `benefits must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)`, 400);
        }
        if (!validateStringArray(updateData.negativeFor)) {
            return apiError(ErrorCode.VALIDATION_ERROR, `negativeFor must be an array of strings (max ${MAX_TAG_ARRAY_LENGTH} items, each max ${MAX_TAG_ITEM_LENGTH} chars)`, 400);
        }

        if (updateData.recommendReasons !== undefined && updateData.recommendReasons !== null) {
            const parsedReasons = recommendReasonsSchema.safeParse(updateData.recommendReasons);
            if (!parsedReasons.success) {
                return apiError(ErrorCode.VALIDATION_ERROR, "Invalid recommendReasons format", 400);
            }
        }

        // Validate boolean fields
        if (updateData.active !== undefined) {
            updateData.active = updateData.active === true;
        }
        if (updateData.featured !== undefined) {
            updateData.featured = updateData.featured === true;
        }

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
                        newName: oldProduct.name,
                        changes: Object.keys(updateData)
                    },
                    ip: clientInfo.ip,
                    userAgent: clientInfo.userAgent,
                }
            });

            return { type: "success" as const, product, oldProduct };
        });

        if (txResult.type === "not_found") {
            return apiError(ErrorCode.NOT_FOUND, "Product not found", 404);
        }

        // 事务提交后立即失效，避免响应前仍读到旧产品列表
        invalidateActiveProductsCache();

        revalidateTag("admin-stats", "max");
        return NextResponse.json(txResult.product);
    } catch (error) {
        logger.error("Failed to update product", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "Failed to update", 500);
    }
});

// DELETE /api/admin/products/[id] - Delete product
// 破坏性操作仅 super_admin
export const DELETE = requireRole(AdminRole.SUPER_ADMIN)(async (
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

        const deletedProduct = await prisma.$transaction(async (tx) => {
            const product = await tx.product.findUnique({ where: { id } });
            if (!product) {
                throw new Error("NOT_FOUND");
            }
            // 主站仍在维护的同步产品禁止在子站删除；仅允许清理主站已删除的失效记录
            if (product.sourceProductId && !product.sourceMissingAt) {
                throw new Error("SYNCED_PRODUCT");
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
            return product;
        });

        invalidateActiveProductsCache();

        await deleteUnreferencedProductAssets(
            productImageRefs(deletedProduct.image, deletedProduct.images),
            id
        );

        revalidateTag("admin-stats", "max");
        return apiSuccess();
    } catch (error: unknown) {
        if (error instanceof Error && error.message === "NOT_FOUND") {
            return apiError(ErrorCode.NOT_FOUND, "Product not found", 404);
        }
        if (error instanceof Error && error.message === "SYNCED_PRODUCT") {
            return apiError(
                ErrorCode.CONFLICT,
                "该产品由主站同步，请在主站删除或下架",
                409
            );
        }
        logger.error("Failed to delete product:", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "Failed to delete", 500);
    }
});
