
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const user = await getSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const history = await prisma.advisorSession.findMany({
            where: {
                user: { id: user.id }, // Use relation filter to avoid 'userId' type issues
                completedAt: { not: null }
            },
            orderBy: { completedAt: 'desc' },
            select: {
                id: true,
                completedAt: true,
                analysisResult: true
            }
        });

        const formattedHistory = history.map(h => {
            const result = h.analysisResult as any;
            return {
                id: h.id,
                date: h.completedAt,
                skinType: result?.skinProfile?.type || result?.skinType?.type || "unknown",
                score: result?.faceAnalysis?.overallScore || 0,
                summary: result?.summary || ""
            };
        });

        return NextResponse.json({
            success: true,
            data: formattedHistory
        });
    } catch (error) {
        console.error("History fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
