
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, getClientInfo } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { Prisma } from "@prisma/client";

// POST - Batch operations on products
// Restricted to super_admin and admin
export const POST = requireRole("super_admin", "admin")(async (request, { admin }) => {
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

                case 'delete':
                    result = await tx.product.deleteMany({
                        where: { id: { in: ids } }
                    });
                    // Junction table records are automatically cleaned up via onDelete: Cascade
                    break;
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

        return NextResponse.json({
            success: true,
            affected: result?.count || 0
        });

    } catch (error) {
        console.error("Batch operation failed:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
});
