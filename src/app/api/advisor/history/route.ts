import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/sso-auth";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 速率限制
    const ip = getClientIP(req);
    const rateLimitResult = await rateLimit(`history-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    const rateLimitHeaders = {
        "X-RateLimit-Limit": String(rateLimitResult.limit),
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        "X-RateLimit-Reset": String(rateLimitResult.reset)
    };
    if (!rateLimitResult.success) {
        return NextResponse.json(
            { error: "请求过于频繁，请稍后再试" },
            { status: 429, headers: rateLimitHeaders }
        );
    }

    try {
        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10) || 10));
        const skip = (page - 1) * pageSize;
        // lite=1：只回传时间线/列表所需字段（score + 肤质标签），裁剪掉产品推荐等大 JSON，节省带宽
        const lite = searchParams.get("lite") === "1";

        const [history, total] = await Promise.all([
            prisma.advisorSession.findMany({
                where: {
                    userId: user.id,
                    completedAt: { not: null },
                    archivedAt: null // 冷层归档摘要对用户不可见
                },
                orderBy: { completedAt: "desc" },
                select: {
                    sessionId: true,
                    completedAt: true,
                    analysisResult: true
                },
                skip,
                take: pageSize
            }),
            prisma.advisorSession.count({
                where: {
                    userId: user.id,
                    completedAt: { not: null },
                    archivedAt: null
                }
            })
        ]);

        const payload = lite
            ? history.map((s) => {
                const result = s.analysisResult as Record<string, unknown> | null | undefined;
                const face = (result?.faceAnalysis ?? null) as { overallScore?: unknown } | null | undefined;
                const skinProfile = (result?.skinProfile ?? null) as { typeLabel?: unknown } | null | undefined;
                const skinType = (result?.skinType ?? null) as { typeLabel?: unknown } | null | undefined;
                const score = typeof face?.overallScore === "number" ? face.overallScore : undefined;
                const typeLabel =
                    typeof skinProfile?.typeLabel === "string" ? skinProfile.typeLabel
                    : typeof skinType?.typeLabel === "string" ? skinType.typeLabel
                    : undefined;
                return {
                    sessionId: s.sessionId,
                    completedAt: s.completedAt,
                    analysisResult: {
                        ...(score != null ? { faceAnalysis: { overallScore: score } } : {}),
                        ...(typeLabel ? { skinProfile: { typeLabel } } : {})
                    }
                };
            })
            : history;

        return NextResponse.json({
            history: payload,
            pagination: {
                page,
                limit: pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        }, { headers: rateLimitHeaders });
    } catch (e) {
        logger.error("History fetch error:", e);
        return NextResponse.json({ error: "Failed to fetch history" }, { status: 500, headers: rateLimitHeaders });
    }
}
