
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/sso-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { hashIP } from "@/lib/privacy";
import { logger } from "@/lib/logger";
import { upsertAutoDiaryEntry } from "@/lib/diary";

/**
 * POST /api/advisor/session/claim
 * Link a guest session to a logged-in user
 */
export async function POST(request: NextRequest) {
    // 速率限制
    const ip = getClientIP(request);
    const limit = await rateLimit(`session-claim-${ip}`, "default", { maxRequests: 10, windowMs: 60 * 1000 });
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

    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: rateLimitHeaders });
        }

        const body = await request.json().catch(() => null);
        const sessionId = body && typeof body === "object" ? (body as { sessionId?: unknown }).sessionId : null;
        if (!sessionId || typeof sessionId !== "string") {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400, headers: rateLimitHeaders });
        }

        // 归属校验：未被认领的游客会话，仅允许同 IP（哈希比对，与 analyze 写入一致）认领，
        // 防止知道他人 sessionId 的用户把别人的游客报告绑到自己账号。
        // 历史遗留的无 ip 记录放行（仍需持有不可猜测的 UUID sessionId）。
        const existing = await prisma.advisorSession.findUnique({
            where: { sessionId },
            select: { userId: true, ip: true }
        });
        if (existing && !existing.userId && existing.ip && existing.ip !== hashIP(ip)) {
            logger.warn(`Claim rejected for session ${sessionId}: IP hash mismatch, requester ${user.id}`);
            return NextResponse.json(
                { error: "Session ownership verification failed" },
                { status: 403, headers: rateLimitHeaders }
            );
        }

        // Atomic claim: only update if userId is null (not yet claimed)
        let claimed = false;
        try {
            const updated = await prisma.advisorSession.updateMany({
                where: { sessionId, userId: null },
                data: { userId: user.id }
            });
            claimed = updated.count > 0;

            if (updated.count === 0) {
                // 可能已被其他用户认领，检查所有权
                const session = await prisma.advisorSession.findUnique({
                    where: { sessionId },
                    select: { userId: true }
                });
                if (session?.userId && session.userId !== user.id) {
                    logger.warn(`Attempted takeover of session ${sessionId}: current owner ${session.userId}, requester ${user.id}`);
                    return NextResponse.json({ error: "Session already claimed" }, { status: 403, headers: rateLimitHeaders });
                }
            }
        } catch (e) {
            logger.error("Failed to claim session:", e);
            return NextResponse.json({ error: "Failed to claim session" }, { status: 500, headers: rateLimitHeaders });
        }

        // 补建当日自动日记：认领的游客测肤（带面部评分）同步生成/更新日记条目，
        // 避免时间线出现测肤里程碑却没有对应日记卡的断层。失败不影响认领结果。
        if (claimed) {
            try {
                const session = await prisma.advisorSession.findUnique({
                    where: { sessionId },
                    select: { completedAt: true, analysisResult: true }
                });
                if (session?.completedAt && session.analysisResult) {
                    const result = session.analysisResult as Record<string, unknown>;
                    const face = (result.faceAnalysis ?? null) as
                        | { overallScore?: unknown }
                        | null | undefined;
                    const overallScore = face?.overallScore;
                    if (typeof overallScore === "number") {
                        // 日期优先用客户端本地日历日（body.dateStr）；缺失时回退 completedAt 的 UTC 日
                        const bodyDateStr = (body as { dateStr?: unknown })?.dateStr;
                        const dateStr =
                            typeof bodyDateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bodyDateStr)
                                ? bodyDateStr
                                : session.completedAt.toISOString().slice(0, 10);
                        const skinProfile = (result.skinProfile ?? null) as { typeLabel?: unknown } | null | undefined;
                        const skinType = (result.skinType ?? null) as { typeLabel?: unknown } | null | undefined;
                        const skinTypeLabel =
                            typeof skinProfile?.typeLabel === "string" ? skinProfile.typeLabel
                            : typeof skinType?.typeLabel === "string" ? skinType.typeLabel
                            : undefined;
                        upsertAutoDiaryEntry({ userId: user.id, dateStr, score: overallScore, skinTypeLabel })
                            .catch((err) => logger.error("[Diary] claim 后补建日记失败:", err));
                    }
                }
            } catch (e) {
                logger.error("[Diary] claim 补建日记查询失败:", e);
            }
        }

        return NextResponse.json({ success: true }, { headers: rateLimitHeaders });
    } catch (error) {
        logger.error("Failed to claim session:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        logger.error("Error details:", { message: errorMessage, stack: errorStack });
        return NextResponse.json({ 
            error: "Internal server error"
        }, { status: 500, headers: rateLimitHeaders });
    }
}
