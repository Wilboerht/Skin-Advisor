
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession, logAdminAction, getClientInfo } from "@/lib/admin-auth";

// GET single reward
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const reward = await prisma.shareReward.findUnique({
            where: { id },
            include: {
                user: {
                    select: { email: true, name: true }
                }
            }
        });

        if (!reward) {
            return NextResponse.json(
                { success: false, error: "Reward not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: reward });
    } catch (error) {
        console.error("Failed to fetch reward:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH - Update reward status/tracking
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { status, trackingNo } = body;
        const clientInfo = getClientInfo(request);

        // Validate status
        const validStatuses = ['pending', 'approved', 'rejected', 'shipped'];
        if (status && !validStatuses.includes(status)) {
            return NextResponse.json(
                { success: false, error: "Invalid status" },
                { status: 400 }
            );
        }

        // Get old reward for audit
        const oldReward = await prisma.shareReward.findUnique({ where: { id } });

        // Build update data
        const updateData: any = {};
        if (status) updateData.status = status;
        if (trackingNo !== undefined) updateData.trackingNo = trackingNo;

        // If shipping, require tracking number
        if (status === 'shipped' && !trackingNo && !body.skipTrackingValidation) {
            return NextResponse.json(
                { success: false, error: "Tracking number required for shipped status" },
                { status: 400 }
            );
        }

        const updated = await prisma.shareReward.update({
            where: { id },
            data: updateData,
        });

        // Log audit
        await logAdminAction({
            adminId: admin.adminId,
            action: status === 'shipped' ? 'ship' : `reward_${status || 'update'}`,
            resource: "ShareReward",
            resourceId: id,
            details: {
                oldStatus: oldReward?.status,
                newStatus: status,
                trackingNo: trackingNo || null,
                userName: oldReward?.name
            },
            ...clientInfo
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error("Failed to update reward:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE - Remove reward
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const clientInfo = getClientInfo(request);

        // Get reward info for audit
        const reward = await prisma.shareReward.findUnique({ where: { id } });

        await prisma.shareReward.delete({
            where: { id },
        });

        // Log audit
        await logAdminAction({
            adminId: admin.adminId,
            action: "delete",
            resource: "ShareReward",
            resourceId: id,
            details: { name: reward?.name, phone: reward?.phone },
            ...clientInfo
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete reward:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
