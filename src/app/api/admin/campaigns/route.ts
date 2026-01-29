
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession, logAdminAction, getClientInfo } from "@/lib/admin-auth";

// GET /api/admin/campaigns - List all campaigns
export async function GET(request: NextRequest) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const campaigns = await prisma.campaign.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { rewards: true }
                }
            }
        });

        return NextResponse.json({
            success: true,
            data: campaigns
        });
    } catch (error) {
        console.error("Failed to fetch campaigns:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

// POST /api/admin/campaigns - Create a new campaign
export async function POST(request: NextRequest) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

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

        if (!name || !startDate || !endDate) {
            return NextResponse.json(
                { success: false, error: "Name, startDate, and endDate are required" },
                { status: 400 }
            );
        }

        // If making this campaign active, deactivate others
        if (isActive) {
            await prisma.campaign.updateMany({
                where: { isActive: true },
                data: { isActive: false }
            });
        }

        const campaign = await prisma.campaign.create({
            data: {
                name,
                description,
                rewardType: rewardType || "sample",
                rewardDescription,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                isActive: isActive ?? true,
                maxParticipants,
                rules,
                bannerImage
            }
        });

        // Log audit
        await logAdminAction({
            adminId: admin.adminId,
            action: "create",
            resource: "Campaign",
            resourceId: campaign.id,
            details: { name: campaign.name },
            ...clientInfo
        });

        return NextResponse.json({
            success: true,
            data: campaign
        });
    } catch (error) {
        console.error("Failed to create campaign:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
