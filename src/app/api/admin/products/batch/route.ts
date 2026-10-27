import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, getClientInfo } from "@/lib/admin-auth";
import { AdminRole } from "@/lib/permissions";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { deleteUnreferencedProductAssets, productImageRefs } from "@/lib/product-assets";
import { logger } from "@/lib/logger";

// POST - Batch operations on products
// Available to super_admin and admin
export const POST = requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)(async (request: NextRequest, { admin }) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-product-batch-${ip}`, "default", { maxRequests: 20, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { ids, action } = body;
        const clientInfo = getClientInfo(request);

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { success: false, error: "No product IDs provided" },
                { status: 400 }
            );
        }

        // Batch size limit to prevent accidental mass operations
        const MAX_BATCH_SIZE = 100;
        if (ids.length > MAX_BATCH_SIZE) {
            return NextResponse.json(
                { success: false, error: `Batch size exceeds limit of ${MAX_BATCH_SIZE}` },
                { status: 400 }
            );
        }

        // Validate all IDs are strings
        if (!ids.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
            return NextResponse.json(
                { success: false, error: "Invalid ID format" },
                { status: 400 }
            );
        }

        const validActions = ['activate', 'deactivate', 'feature', 'unfeature', 'delete'];
        if (!validActions.includes(action)) {
            return NextResponse.json(
                { success: false, error: "Invalid action" },
                { status: 400 }
            );
        }

        // 批量删除属破坏性操作，仅 super_admin 可执行
        if (action === 'delete' && admin.role !== AdminRole.SUPER_ADMIN) {
            return NextResponse.json(
                { success: false, error: "Forbidden - super_admin required" },
                { status: 403 }
            );
        }

        const productsToDelete = action === 'delete'
            ? await prisma.product.findMany({
                where: { id: { in: ids } },
                select: { id: true, image: true, images: true },
            })
            : [];

        let result: { count: number } | undefined;

        await prisma.$transaction(async (tx) => {
            switch (action) {
                case 'activate':
                    result = await tx.product.updateMany({
                        where: { id: { in: ids } },
                        data: { active: true }
                    });
                    break;

                case 'deactivate':
                    result = await tx.product.updateMany({
                        where: { id: { in: ids } },
                        data: { active: false }
                    });
                    break;

                case 'feature':
                    result = await tx.product.updateMany({
                        where: { id: { in: ids } },
                        data: { featured: true }
                    });
                    break;

                case 'unfeature':
                    result = await tx.product.updateMany({
                        where: { id: { in: ids } },
                        data: { featured: false }
                    });
                    break;

                case 'delete': {
                    // 主站仍在维护的同步产品禁止在子站删除；仅允许清理主站已删除的失效记录
                    const protectedProducts = await tx.product.findMany({
                        where: {
                            id: { in: ids },
                            sourceProductId: { not: null },
                            sourceMissingAt: null,
                        },
                        select: { name: true },
                    });
                    if (protectedProducts.length > 0) {
                        throw new Error(
                            `SYNCED_PRODUCTS:${protectedProducts.map((p) => p.name).join("、")}`
                        );
                    }
                    result = await tx.product.deleteMany({
                        where: { id: { in: ids } }
                    });
                    // Junction table records are automatically cleaned up via onDelete: Cascade
                    break;
                }
            }

            // Log audit inside transaction
            await tx.adminAuditLog.create({
                data: {
                    adminId: admin.adminId,
                    action: `batch_${action}`,
                    resource: "Product",
                    details: {
                        affectedIds: ids,
                        count: result?.count || 0
                    },
                    ip: clientInfo.ip,
                    userAgent: clientInfo.userAgent,
                }
            });
        });

        if (action === 'delete') {
            for (const product of productsToDelete) {
                await deleteUnreferencedProductAssets(
                    productImageRefs(product.image, product.images),
                    product.id
                );
            }
        }

        return NextResponse.json({
            success: true,
            affected: result?.count || 0
        });

    } catch (error) {
        if (error instanceof Error && error.message.startsWith("SYNCED_PRODUCTS:")) {
            return NextResponse.json(
                {
                    success: false,
                    error: `以下产品由主站同步，请在主站删除或下架：${error.message.slice("SYNCED_PRODUCTS:".length)}`,
                },
                { status: 409 }
            );
        }
        logger.error("Batch operation failed:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
});
