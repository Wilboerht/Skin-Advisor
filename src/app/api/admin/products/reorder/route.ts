
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
        const existingCount = await prisma.product.count({
            where: { id: { in: orderedIds } }
        });
        if (existingCount !== orderedIds.length) {
            return NextResponse.json(
                { success: false, error: "Some product IDs do not exist" },
                { status: 400 }
            );
        }

        const totalProductCount = await prisma.product.count();
        if (orderedIds.length !== totalProductCount) {
            return NextResponse.json(
                { success: false, error: `Reorder list must include all products (expected ${totalProductCount}, got ${orderedIds.length})` },
                { status: 400 }
            );
        }

        // Update sortOrder for each product
        await prisma.$transaction(
            orderedIds.map((id: string, index: number) =>
                prisma.product.update({
                    where: { id },
                    data: { sortOrder: index }
                })
            )
        );

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
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
});
