import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser, isSubsiteAccountDisabled } from "@/lib/sso-auth";
import { accountDisabledResponse } from "@/lib/api-response";
import { normalizeAnalysisResult } from "@/lib/analysis-result";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import { buildReportView } from "@/lib/report/view";
import type { ReportViewSummaryCard } from "@/lib/report/types";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

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
    if (!limit.success) {
        return NextResponse.json(
            { error: "请求过于频繁，请稍后再试" },
            { status: 429, headers: rateLimitHeaders }
        );
    }

    try {
        const user = await getSessionUser(request);
        if (!user) {
            if (await isSubsiteAccountDisabled(request)) return accountDisabledResponse();
            return NextResponse.json({ error: "请先登录" }, { status: 401, headers: rateLimitHeaders });
        }

        const { id: sessionId } = await context.params;
        if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
            return NextResponse.json({ error: "缺少报告参数" }, { status: 400, headers: rateLimitHeaders });
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
            return NextResponse.json({ error: "报告不存在或无权访问" }, { status: 404, headers: rateLimitHeaders });
        }
        if (session.archivedAt || !session.analysisResult) {
            return NextResponse.json({ error: "报告不存在或已归档" }, { status: 404, headers: rateLimitHeaders });
        }

        const raw = session.analysisResult as Record<string, unknown>;
        const result = normalizeAnalysisResult(raw);
        if (!result) {
            return NextResponse.json({ error: "报告不存在或尚未生成" }, { status: 404, headers: rateLimitHeaders });
        }
        const faceAnalysis = (raw.faceAnalysis as FaceAnalysisResult | null) || null;
        const view = buildReportView({ result, faceAnalysis, sessionId });

        const wantsSummary = request.nextUrl.searchParams.get("summary") === "1";
        if (wantsSummary) {
            const summary: ReportViewSummaryCard = {
                sessionId,
                completedAt: session.completedAt?.toISOString(),
                overallScore: view.meta.overallScore,
                skinTypeLabel: view.meta.skinTypeLabel,
                skinAge: view.meta.skinAge,
                persona: view.meta.persona,
                reportVersion: view.meta.reportVersion,
                viewVersion: view.meta.viewVersion,
                topFinding: view.summary.topFinding ? {
                    title: view.summary.topFinding.title,
                    severity: view.summary.topFinding.severity,
                    severityLabel: view.summary.topFinding.severityLabel,
                } : undefined,
            };
            return NextResponse.json({ summary }, { headers: rateLimitHeaders });
        }

        return NextResponse.json({ view }, { headers: rateLimitHeaders });
    } catch (error) {
        logger.error("[reports/view] failed", { error: String(error) });
        return NextResponse.json(
            { error: "报告加载失败，请稍后重试" },
            { status: 500, headers: rateLimitHeaders }
        );
    }
}
