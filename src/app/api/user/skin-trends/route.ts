
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

        // 获取最近 12 次分析结果，用于对比（先按时间倒序取最新 12 条，再翻转为时间正序）
        const recentSessions = (
            await prisma.advisorSession.findMany({
                where: {
                    user: { id: user.id }, // Use relation filter
                    completedAt: { not: null }
                },
                orderBy: { completedAt: 'desc' },
                take: 12,
                select: {
                    completedAt: true,
                    analysisResult: true
                }
            })
        ).reverse();

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

        // 过滤缺失/非法评分的样本：兜底 0 会把趋势域拉到 0、曲线失真
        const validSessions = recentSessions.filter((s) => {
            const score = asFaceAnalysis(s.analysisResult)?.overallScore;
            return typeof score === "number" && Number.isFinite(score) && score > 0;
        });

        if (validSessions.length < 2) {
            return NextResponse.json({
                success: true,
                data: null,
                message: "Not enough data for trend analysis"
            }, { headers: rateLimitHeaders });
        }

        const trends = {
            dates: validSessions.map(s => s.completedAt),
            scores: validSessions.map(s => asFaceAnalysis(s.analysisResult)?.overallScore || 0),
            dimensions: {
                wrinkles: validSessions.map(s => asFaceAnalysis(s.analysisResult)?.dimensions?.wrinkles?.score || 0),
                waterOil: validSessions.map(s => asFaceAnalysis(s.analysisResult)?.dimensions?.waterOil?.score || 0),
                spots: validSessions.map(s => asFaceAnalysis(s.analysisResult)?.dimensions?.spots?.score || 0),
                texture: validSessions.map(s => asFaceAnalysis(s.analysisResult)?.dimensions?.texture?.score || 0),
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
