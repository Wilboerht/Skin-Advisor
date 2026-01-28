
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
    status: z.enum(["pending", "approved", "rejected", "shipped"]).optional(),
    trackingNo: z.string().optional()
});

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const body = await request.json();
        const validation = updateSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { success: false, error: "Invalid data", details: validation.error.format() },
                { status: 400 }
            );
        }

        const { status, trackingNo } = validation.data;

        // Ensure the reward exists
        const existing = await prisma.shareReward.findUnique({
            where: { id: params.id }
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Reward not found" },
                { status: 404 }
            );
        }

        const updated = await prisma.shareReward.update({
            where: { id: params.id },
            data: {
                ...(status && { status }),
                ...(trackingNo !== undefined && { trackingNo }) // Allow clearing trackingNo if empty string passed? Or just generic update.
            }
        });

        return NextResponse.json({
            success: true,
            data: updated
        });

    } catch (error) {
        console.error("Failed to update reward:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
