
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const user = await getSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 获取最近 5 次分析结果，用于对比
        const recentSessions = await prisma.advisorSession.findMany({
            where: {
                user: { id: user.id }, // Use relation filter
                completedAt: { not: null }
            },
            orderBy: { completedAt: 'asc' }, // 按时间顺序
            take: 5,
            select: {
                completedAt: true,
                analysisResult: true
            }
        });

        if (recentSessions.length < 2) {
            return NextResponse.json({
                success: true,
                data: null,
                message: "Not enough data for trend analysis"
            });
        }

        const trends = {
            dates: recentSessions.map(s => s.completedAt),
            scores: recentSessions.map(s => (s.analysisResult as any)?.faceAnalysis?.overallScore || 0),
            dimensions: {
                wrinkles: recentSessions.map(s => (s.analysisResult as any)?.faceAnalysis?.dimensions?.wrinkles?.score || 0),
                pores: recentSessions.map(s => (s.analysisResult as any)?.faceAnalysis?.dimensions?.pores?.score || 0),
                spots: recentSessions.map(s => (s.analysisResult as any)?.faceAnalysis?.dimensions?.spots?.score || 0),
                texture: recentSessions.map(s => (s.analysisResult as any)?.faceAnalysis?.dimensions?.texture?.score || 0),
            }
        };

        return NextResponse.json({
            success: true,
            data: trends
        });
    } catch (error) {
        console.error("Trend fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
