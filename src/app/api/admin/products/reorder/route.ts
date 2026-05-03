
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

// POST - Reorder products
export async function POST(request: NextRequest) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

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

        // Verify all IDs exist before updating
        const existingCount = await prisma.product.count({
            where: { id: { in: orderedIds } }
        });
        if (existingCount !== orderedIds.length) {
            return NextResponse.json(
                { success: false, error: "Some product IDs do not exist" },
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

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Reorder failed:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
