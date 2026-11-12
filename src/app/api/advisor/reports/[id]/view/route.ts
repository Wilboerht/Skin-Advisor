import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser, isSubsiteAccountDisabled } from "@/lib/sso-auth";
import { accountDisabledResponse } from "@/lib/api-response";
import { isCompletedAnalysisResult, normalizeAnalysisResult } from "@/lib/analysis-result";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import { buildReportSummaryCard, buildReportView } from "@/lib/report/view";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { apiError } from "@/lib/api-response";

export const maxDuration = 10;

const SESSION_ID_RE = /^[0-9A-Za-z-]{8,128}$/;

/**
 * 跨端报告视图接口。
 *
 * - H5 / 小程序共用：v3 直接投影，v2/v1 由 buildReportView 适配；
 * - 不返回原始 analysisResult，避免客户端重复实现解析逻辑；
 * - ?summary=1 返回历史列表/档案时间线所需的轻量字段。
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const ip = getClientIP(request);
    const limit = await rateLimit(`reports-view-${ip}`, "default", { maxRequests: 90, windowMs: 60 * 1000 });
    const rateLimitHeaders = {
        "X-RateLimit-Limit": String(limit.limit),
        "X-RateLimit-Remaining": String(limit.remaining),
        "X-RateLimit-Reset": String(limit.reset),
        "Cache-Control": "private, no-store",
    };
    const errorResponse = (code: string, message: string, status: number) => {
        const response = apiError(code, message, status);
        Object.entries(rateLimitHeaders).forEach(([key, value]) => response.headers.set(key, value));
        return response;
    };
    if (!limit.success) {
        return errorResponse("RATE_LIMITED", "请求过于频繁，请稍后再试", 429);
    }

    try {
        const user = await getSessionUser(request);
        if (!user) {
            if (await isSubsiteAccountDisabled(request)) return accountDisabledResponse();
            return errorResponse("UNAUTHORIZED", "请先登录", 401);
        }

        const { id: sessionId } = await context.params;
        if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
            return errorResponse("VALIDATION_ERROR", "缺少报告参数", 400);
        }

        const session = await prisma.advisorSession.findUnique({
            where: { sessionId },
            select: {
                sessionId: true,
                userId: true,
                completedAt: true,
                expiresAt: true,
                archivedAt: true,
                analysisResult: true,
            },
        });

        // 统一 404：不暴露他人会话是否存在
        if (!session || session.userId !== user.id) {
            return errorResponse("NOT_FOUND", "报告不存在或无权访问", 404);
        }
        if (!session.completedAt || session.archivedAt || !session.analysisResult) {
            return errorResponse("NOT_FOUND", "报告不存在或已归档", 404);
        }

        const raw = session.analysisResult as Record<string, unknown>;
        if (!isCompletedAnalysisResult(raw)) {
            return errorResponse("NOT_FOUND", "报告尚未生成", 404);
        }
        const result = normalizeAnalysisResult(raw);
        if (!result) {
            return errorResponse("NOT_FOUND", "报告不存在或尚未生成", 404);
        }
        const faceAnalysis = (raw.faceAnalysis as FaceAnalysisResult | null) || null;

        // summary 只构建轻量卡片，不展开 dimensions/findings/routine/products，
        // 避免历史列表/档案时间线为每份报告做整份投影。
        if (request.nextUrl.searchParams.get("summary") === "1") {
            const summary = buildReportSummaryCard({
                result,
                faceAnalysis,
                sessionId,
                completedAt: session.completedAt.toISOString(),
            });
            return NextResponse.json({ summary }, { headers: rateLimitHeaders });
        }

        const view = buildReportView({ result, faceAnalysis, sessionId });
        return NextResponse.json({ view }, { headers: rateLimitHeaders });
    } catch (error) {
        logger.error("[reports/view] failed", { error: String(error) });
        return errorResponse("INTERNAL_ERROR", "报告加载失败，请稍后重试", 500);
    }
}
