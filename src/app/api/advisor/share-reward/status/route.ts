import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const campaignId = searchParams.get("campaignId");
        const contact = searchParams.get("contact");

        if (!campaignId || !contact) {
            return NextResponse.json(
                { success: false, error: "Missing parameters" },
                { status: 400 }
            );
        }

        const submission = await prisma.shareReward.findFirst({
            where: {
                // 如果只提供 phone (作为 contact)
                phone: contact,
                // 也可以加 campaignId 限制，如果 schema 支持
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json({
            success: true,
            data: submission || null
        });
    } catch (error) {
        console.error("Status check failed:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
