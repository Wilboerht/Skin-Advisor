import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser, isSubsiteAccountDisabled } from "@/lib/sso-auth";
import { accountDisabledResponse } from "@/lib/api-response";
import { normalizeAnalysisResult } from "@/lib/analysis-result";
import { normalizeImagePath } from "@/types/product";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

const MIN_DAYS_BEFORE_FEEDBACK = 28;
const MAX_ITEMS = 12;

export interface PendingProductFeedbackItem {
    sessionId: string;
    completedAt: string;
    daysSince: number;
    productId: string;
    productName: string;
    category?: string;
    image?: string;
    reason?: string;
}

/**
 * GET /api/user/product-feedback/pending
 * 返回已完成 28 天以上、尚未反馈过的推荐产品（站内产品反馈入口使用）。
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            if (await isSubsiteAccountDisabled(request)) return accountDisabledResponse();
            return NextResponse.json({ error: "请先登录" }, { status: 401 });
        }

        const ip = getClientIP(request);
        const limit = await rateLimit(`product-feedback-pending-${user.id}-${ip}`, "default", {
            maxRequests: 30,
            windowMs: 60 * 1000,
        });
        if (!limit.success) {
            return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
        }

        const cutoff = new Date(Date.now() - MIN_DAYS_BEFORE_FEEDBACK * 24 * 60 * 60 * 1000);
        const [sessions, feedbacks] = await Promise.all([
            prisma.advisorSession.findMany({
                where: {
                    userId: user.id,
                    completedAt: { not: null, lte: cutoff },
                    archivedAt: null,
                },
                orderBy: { completedAt: "desc" },
                take: 30,
                select: {
                    sessionId: true,
                    completedAt: true,
                    analysisResult: true,
                },
            }),
            prisma.productFeedback.findMany({
                where: { userId: user.id },
                select: { sessionId: true, productId: true },
            }),
        ]);

        const seen = new Set(feedbacks.map((item) => `${item.sessionId || ""}:${item.productId}`));
        const items: PendingProductFeedbackItem[] = [];
        const now = Date.now();

        for (const session of sessions) {
            if (!session.completedAt) continue;
            const result = normalizeAnalysisResult(session.analysisResult);
            if (!result?.products?.length) continue;
            const daysSince = Math.floor((now - session.completedAt.getTime()) / 86_400_000);
            for (const product of result.products) {
                if (!product.id || !product.name) continue;
                if (seen.has(`${session.sessionId}:${product.id}`)) continue;
                items.push({
                    sessionId: session.sessionId,
                    completedAt: session.completedAt.toISOString(),
                    daysSince,
                    productId: String(product.id),
                    productName: product.name,
                    category: product.category || undefined,
                    image: product.image ? normalizeImagePath(product.image) : undefined,
                    reason: product.reason || undefined,
                });
                if (items.length >= MAX_ITEMS) break;
            }
            if (items.length >= MAX_ITEMS) break;
        }

        return NextResponse.json({ items });
    } catch (error) {
        logger.error("[product-feedback/pending] failed", { error: String(error) });
        return NextResponse.json({ error: "加载失败，请稍后重试" }, { status: 500 });
    }
}
