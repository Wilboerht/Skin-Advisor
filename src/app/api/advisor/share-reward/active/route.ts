
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/advisor/share-reward/active - Get active campaign for user
export async function GET() {
    try {
        const now = new Date();

        const campaign = await prisma.campaign.findFirst({
            where: {
                isActive: true,
                startDate: { lte: now },
                endDate: { gte: now }
            },
            select: {
                id: true,
                name: true,
                description: true,
                rewardType: true,
                rewardDescription: true,
                startDate: true,
                endDate: true,
                maxParticipants: true,
                currentParticipants: true,
                rules: true,
                bannerImage: true
            }
        });

        if (!campaign) {
            return NextResponse.json({
                success: true,
                data: null,
                message: "No active campaign"
            });
        }

        // Check if campaign is full
        const isFull = campaign.maxParticipants
            ? campaign.currentParticipants >= campaign.maxParticipants
            : false;

        return NextResponse.json({
            success: true,
            data: {
                ...campaign,
                isFull,
                remainingSlots: campaign.maxParticipants
                    ? campaign.maxParticipants - campaign.currentParticipants
                    : null
            }
        });
    } catch (error) {
        console.error("Failed to fetch active campaign:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
