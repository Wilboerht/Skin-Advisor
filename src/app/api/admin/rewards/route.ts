
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const skip = (page - 1) * limit;

        const whereCondition = status ? { status: status } : {};

        const [rewards, total] = await Promise.all([
            prisma.shareReward.findMany({
                where: whereCondition,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.shareReward.count({ where: whereCondition })
        ]);

        return NextResponse.json({
            success: true,
            data: rewards,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Failed to fetch rewards:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
