
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

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
        const user = await getSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: rateLimitHeaders });
        }

        const { sessionId } = await request.json();
        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400, headers: rateLimitHeaders });
        }


        // Atomic claim: only update if userId is null (not yet claimed)
        try {
            const updated = await prisma.advisorSession.updateMany({
                where: { sessionId, userId: null },
                data: { userId: user.id }
            });

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
