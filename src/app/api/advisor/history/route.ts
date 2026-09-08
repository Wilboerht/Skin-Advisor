import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/sso-auth";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { hashIP } from "@/lib/privacy";
import { upsertAutoDiaryEntry } from "@/lib/diary";
import { logger } from "@/lib/logger";

/**
 * 懒认领：把同 IP（哈希）的历史游客测肤绑定到当前登录用户。
 *
 * 背景：游客测肤的认领唯一入口是结果页的 session/claim，登录态不稳定
 * 时期 claim 静默失败会留下 userId=NULL 的孤儿记录，导致护肤档案
 * 显示"无测肤记录"。此处沿用 claim 路由的归属规则（IP 哈希匹配，
 * 无 IP 的历史遗留记录不动），用户打开档案时自动修复。
 */
async function lazyClaimGuestSessions(userId: string, ip: string): Promise<void> {
    try {
        const ipHash = hashIP(ip);
        const claimable = await prisma.advisorSession.findMany({
            where: { userId: null, ip: ipHash, completedAt: { not: null } },
            select: { sessionId: true, completedAt: true, analysisResult: true }
        });
        if (claimable.length === 0) return;

        const claimed = await prisma.advisorSession.updateMany({
            where: {
                userId: null,
                ip: ipHash,
                completedAt: { not: null },
                sessionId: { in: claimable.map((s) => s.sessionId) }
            },
            data: { userId }
        });
        if (claimed.count === 0) return;
        logger.info(`[history] Lazy-claimed ${claimed.count} guest session(s) for user ${userId}`);

        // 补建自动日记条目（与 claim 路由一致；best-effort，不阻塞响应）
        for (const session of claimable) {
            try {
                const result = session.analysisResult as Record<string, unknown> | null;
                if (!session.completedAt || !result) continue;
                const face = (result.faceAnalysis ?? null) as { overallScore?: unknown } | null | undefined;
                if (typeof face?.overallScore !== "number") continue;
                const skinProfile = (result.skinProfile ?? null) as { typeLabel?: unknown } | null | undefined;
                const skinAnalysis = (result.skinAnalysis ?? null) as { typeLabel?: unknown } | null | undefined;
                const skinTypeLabel =
                    typeof skinProfile?.typeLabel === "string" ? skinProfile.typeLabel
                    : typeof skinAnalysis?.typeLabel === "string" ? skinAnalysis.typeLabel
                    : undefined;
                upsertAutoDiaryEntry({
                    userId,
                    dateStr: session.completedAt.toISOString().slice(0, 10),
                    score: face.overallScore,
                    skinTypeLabel,
                    sessionId: session.sessionId
                }).catch((err) => logger.error("[history] 懒认领补建日记失败:", err));
            } catch (e) {
                logger.error("[history] 懒认领补建日记查询失败:", e);
            }
        }
    } catch (e) {
        // 认领失败不影响主查询
        logger.error("[history] Lazy claim failed:", e);
    }
}

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

    await lazyClaimGuestSessions(user.id, ip);

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
                const skinAnalysis = (result?.skinAnalysis ?? null) as { typeLabel?: unknown } | null | undefined;
                const score = typeof face?.overallScore === "number" ? face.overallScore : undefined;
                const typeLabel =
                    typeof skinProfile?.typeLabel === "string" ? skinProfile.typeLabel
                    : typeof skinAnalysis?.typeLabel === "string" ? skinAnalysis.typeLabel
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
