import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { extractReportSummary } from "@/lib/internal-report";
import { getScoreDistribution } from "@/lib/score-percentile-db";
import { percentileFromDistribution } from "@/lib/score-percentile";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { authorizeInternalRequest } from "@/lib/internal-api";
import { logger } from "@/lib/logger";

const SESSION_ID_RE = /^[0-9A-Za-z-]{8,128}$/;

/**
 * 内部接口：按 sessionId 返回测肤报告摘要。
 * 仅供企业微信 AI 客服服务调用。
 * 鉴权：优先 HMAC 签名，过渡期兼容旧版 x-internal-key；
 * 返回字段最小化，不包含人脸图片等敏感数据。
 */
export async function GET(request: NextRequest) {
    const auth = await authorizeInternalRequest(request, { legacy: "x-internal-key" });
    if (!auth.ok) {
        return NextResponse.json({ error: "Unauthorized" }, { status: auth.status ?? 401 });
    }

    const sessionId = request.nextUrl.searchParams.get("sessionId") || "";
    if (!SESSION_ID_RE.test(sessionId)) {
        return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    // IP 级兜底限流，防止密钥泄漏后被批量扫描
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`internal-report-summary-${ip}`, "default", { maxRequests: 120, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const session = await prisma.advisorSession.findUnique({
            where: { sessionId, archivedAt: null }, // 冷层归档摘要对用户不可见，内部接口保持同一可见性语义
            select: { analysisResult: true, answers: true, expiresAt: true, createdAt: true },
        });

        if (!session?.analysisResult) {
            return NextResponse.json({ found: false }, { status: 404 });
        }
        if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
            return NextResponse.json({ found: false }, { status: 404 });
        }

        // 真实聚合百分位（与前端证书口径一致）；聚合失败不阻断主流程
        let percentile: number | null = null;
        try {
            const faceAnalysis = (session.analysisResult as Record<string, unknown>).faceAnalysis as { overallScore?: unknown } | undefined;
            if (typeof faceAnalysis?.overallScore === "number") {
                const dist = await getScoreDistribution();
                percentile = percentileFromDistribution(dist, Math.round(faceAnalysis.overallScore));
            }
        } catch (e) {
            logger.warn("report-summary percentile aggregate failed", { error: String(e) });
        }

        const summary = extractReportSummary(session.analysisResult, sessionId, session.answers, percentile);
        if (!summary.found) {
            return NextResponse.json({ found: false }, { status: 404 });
        }
        return NextResponse.json({ ...summary, createdAt: session.createdAt.toISOString() });
    } catch (error) {
        logger.error("report-summary failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
