
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/sso-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 速率限制
        const ip = getClientIP(request);
        const limit = await rateLimit(`skin-trends-${ip}`, "default", { maxRequests: 20, windowMs: 60 * 1000 });
        const rateLimitHeaders = {
            "X-RateLimit-Limit": String(limit.limit),
            "X-RateLimit-Remaining": String(limit.remaining),
            "X-RateLimit-Reset": String(limit.reset)
        };
        if (!limit.success) {
            return NextResponse.json(
                { error: "请求过于频繁，请稍后再试" },
                { status: 429, headers: rateLimitHeaders }
            );
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
            }, { headers: rateLimitHeaders });
        }

        // analysisResult 为 JSON 快照，用结构化类型收窄后安全读取
        interface TrendDimension { score?: number }
        interface TrendFaceAnalysis {
            overallScore?: number;
            dimensions?: {
                wrinkles?: TrendDimension;
                waterOil?: TrendDimension;
                spots?: TrendDimension;
                texture?: TrendDimension;
            };
        }
        const asFaceAnalysis = (result: unknown): TrendFaceAnalysis | undefined =>
            (result as { faceAnalysis?: TrendFaceAnalysis } | null | undefined)?.faceAnalysis;

        const trends = {
            dates: recentSessions.map(s => s.completedAt),
            scores: recentSessions.map(s => asFaceAnalysis(s.analysisResult)?.overallScore || 0),
            dimensions: {
                wrinkles: recentSessions.map(s => asFaceAnalysis(s.analysisResult)?.dimensions?.wrinkles?.score || 0),
                waterOil: recentSessions.map(s => asFaceAnalysis(s.analysisResult)?.dimensions?.waterOil?.score || 0),
                spots: recentSessions.map(s => asFaceAnalysis(s.analysisResult)?.dimensions?.spots?.score || 0),
                texture: recentSessions.map(s => asFaceAnalysis(s.analysisResult)?.dimensions?.texture?.score || 0),
            }
        };

        return NextResponse.json({
            success: true,
            data: trends
        }, { headers: rateLimitHeaders });
    } catch (error) {
        logger.error("Trend fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
