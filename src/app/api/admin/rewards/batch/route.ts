
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession, logAdminAction, getClientInfo } from "@/lib/admin-auth";

// POST - Batch update rewards
export async function POST(request: NextRequest) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { ids, action, trackingNo } = body;
        const clientInfo = getClientInfo(request);

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { success: false, error: "No reward IDs provided" },
                { status: 400 }
            );
        }

        const validActions = ['approve', 'reject', 'ship', 'delete'];
        if (!validActions.includes(action)) {
            return NextResponse.json(
                { success: false, error: "Invalid action" },
                { status: 400 }
            );
        }

        let result;

        switch (action) {
            case 'approve':
                result = await prisma.shareReward.updateMany({
                    where: { id: { in: ids } },
                    data: { status: 'approved' }
                });
                break;

            case 'reject':
                result = await prisma.shareReward.updateMany({
                    where: { id: { in: ids } },
                    data: { status: 'rejected' }
                });
                break;

            case 'ship':
                if (!trackingNo) {
                    return NextResponse.json(
                        { success: false, error: "Tracking number required for shipping" },
                        { status: 400 }
                    );
                }
                result = await prisma.shareReward.updateMany({
                    where: { id: { in: ids } },
                    data: { status: 'shipped', trackingNo }
                });
                break;

            case 'delete':
                result = await prisma.shareReward.deleteMany({
                    where: { id: { in: ids } }
                });
                break;
        }

        // Log audit for batch operation
        await logAdminAction({
            adminId: admin.adminId,
            action: `batch_${action}`,
            resource: "ShareReward",
            details: {
                affectedIds: ids,
                count: result?.count || 0,
                trackingNo: action === 'ship' ? trackingNo : undefined
            },
            ...clientInfo
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
}
