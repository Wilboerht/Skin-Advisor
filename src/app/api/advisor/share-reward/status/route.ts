import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/advisor/share-reward/status
 * 
 * Check the status of the current user's share reward submission.
 * Requires authentication. Returns minimal data (status only, no personal info).
 */
export async function GET(request: NextRequest) {
    try {
        // Require authentication
        const user = await getSession();
        if (!user) {
            return NextResponse.json(
                { success: false, error: "请先登录" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const campaignId = searchParams.get("campaignId");
        const phone = searchParams.get("phone");

        if (!phone) {
            return NextResponse.json(
                { success: false, error: "缺少手机号参数" },
                { status: 400 }
            );
        }

        const whereClause: any = {
            phone: phone,
        };

        // Optionally filter by campaign
        if (campaignId) {
            whereClause.campaignId = campaignId;
        }

        const submission = await prisma.shareReward.findFirst({
            where: whereClause,
            orderBy: {
                createdAt: "desc"
            },
            select: {
                id: true,
                status: true,
                createdAt: true,
                // Don't leak personal info (name, phone, address)
            }
        });

        return NextResponse.json({
            success: true,
            data: submission || null
        });
    } catch (error) {
        console.error("Status check failed:", error);
        return NextResponse.json(
            { success: false, error: "查询失败" },
            { status: 500 }
        );
    }
}
