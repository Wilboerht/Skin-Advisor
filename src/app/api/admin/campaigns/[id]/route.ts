
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession, logAdminAction, getClientInfo } from "@/lib/admin-auth";

// GET /api/admin/campaigns/[id] - Get single campaign
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
        const campaign = await prisma.campaign.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { rewards: true }
                },
                rewards: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });

        if (!campaign) {
            return NextResponse.json(
                { success: false, error: "Campaign not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: campaign
        });
    } catch (error) {
        console.error("Failed to fetch campaign:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

// PUT /api/admin/campaigns/[id] - Update campaign
export async function PUT(
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
        const clientInfo = getClientInfo(request);

        const {
            name,
            description,
            rewardType,
            rewardDescription,
            startDate,
            endDate,
            isActive,
            maxParticipants,
            rules,
            bannerImage
        } = body;

        // Get old campaign for audit
        const oldCampaign = await prisma.campaign.findUnique({ where: { id } });
        if (!oldCampaign) {
            return NextResponse.json(
                { success: false, error: "Campaign not found" },
                { status: 404 }
            );
        }

        // If making this campaign active, deactivate others
        if (isActive && !oldCampaign.isActive) {
            await prisma.campaign.updateMany({
                where: { isActive: true, id: { not: id } },
                data: { isActive: false }
            });
        }

        const campaign = await prisma.campaign.update({
            where: { id },
            data: {
                name,
                description,
                rewardType,
                rewardDescription,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                isActive,
                maxParticipants,
                rules,
                bannerImage
            }
        });

        // Log audit
        await logAdminAction({
            adminId: admin.adminId,
            action: "update",
            resource: "Campaign",
            resourceId: id,
            details: {
                oldName: oldCampaign.name,
                newName: name,
                wasActive: oldCampaign.isActive,
                nowActive: isActive
            },
            ...clientInfo
        });

        return NextResponse.json({
            success: true,
            data: campaign
        });
    } catch (error) {
        console.error("Failed to update campaign:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE /api/admin/campaigns/[id] - Delete campaign
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

        const campaign = await prisma.campaign.findUnique({ where: { id } });
        if (!campaign) {
            return NextResponse.json(
                { success: false, error: "Campaign not found" },
                { status: 404 }
            );
        }

        await prisma.campaign.delete({ where: { id } });

        // Log audit
        await logAdminAction({
            adminId: admin.adminId,
            action: "delete",
            resource: "Campaign",
            resourceId: id,
            details: { name: campaign.name },
            ...clientInfo
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete campaign:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
