
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, logAdminAction, getClientInfo } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

// POST - Reorder products
// Restricted to super_admin and admin
export const POST = requireRole("super_admin", "admin")(async (request, { admin }) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-product-reorder-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { orderedIds } = body;

        if (!orderedIds || !Array.isArray(orderedIds)) {
            return NextResponse.json(
                { success: false, error: "orderedIds array required" },
                { status: 400 }
            );
        }

        // Size limit to prevent excessive transaction load
        const MAX_REORDER_SIZE = 100;
        if (orderedIds.length > MAX_REORDER_SIZE) {
            return NextResponse.json(
                { success: false, error: `Reorder list exceeds limit of ${MAX_REORDER_SIZE}` },
                { status: 400 }
            );
        }

        // Validate all IDs are strings
        if (!orderedIds.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
            return NextResponse.json(
                { success: false, error: "Invalid ID format in orderedIds" },
                { status: 400 }
            );
        }

        // Verify all IDs exist and the list is complete (contains all products)
        // Wrapped in transaction with PostgreSQL advisory lock to avoid concurrent reorder conflicts
        await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('product_reorder'))`;

            const existingCount = await tx.product.count({
                where: { id: { in: orderedIds } }
            });
            if (existingCount !== orderedIds.length) {
                throw new Error("Some product IDs do not exist");
            }

            const totalProductCount = await tx.product.count();
            if (orderedIds.length !== totalProductCount) {
                throw new Error(`Reorder list must include all products (expected ${totalProductCount}, got ${orderedIds.length})`);
            }

            // Update sortOrder for each product
            for (let index = 0; index < orderedIds.length; index++) {
                await tx.product.update({
                    where: { id: orderedIds[index] },
                    data: { sortOrder: index }
                });
            }
        });

        // Audit log
        const clientInfo = getClientInfo(request);
        await logAdminAction({
            adminId: admin.adminId,
            action: "reorder",
            resource: "Product",
            details: { count: orderedIds.length },
            ...clientInfo,
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Reorder failed:", error);
        const message = error instanceof Error ? error.message : "Internal server error";
        if (message.includes("do not exist") || message.includes("must include all products")) {
            return NextResponse.json(
                { success: false, error: message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
});
