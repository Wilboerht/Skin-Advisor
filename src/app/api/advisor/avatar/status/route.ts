import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const sessionId = req.nextUrl.searchParams.get("sessionId");

        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        const session = await prisma.advisorSession.findUnique({
            where: { sessionId },
            select: { analysisResult: true }
        });

        if (!session || !session.analysisResult) {
            return NextResponse.json({ generatedAvatar: null });
        }

        const result = session.analysisResult as any;
        const generatedAvatar = result.generatedAvatar || null;

        return NextResponse.json({
            generatedAvatar,
            isReady: !!generatedAvatar
        });

    } catch (error: any) {
        console.error("Failed to fetch avatar status:", error);
        return NextResponse.json({
            error: "Failed to fetch avatar status",
            details: error.message
        }, { status: 500 });
    }
}
