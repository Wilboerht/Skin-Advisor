
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
