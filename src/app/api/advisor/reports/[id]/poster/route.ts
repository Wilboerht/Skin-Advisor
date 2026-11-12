import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSessionUser, isSubsiteAccountDisabled } from "@/lib/sso-auth";
import { accountDisabledResponse } from "@/lib/api-response";
import { normalizeAnalysisResult } from "@/lib/analysis-result";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import { getSkinTypeByIpKey } from "@/lib/result-content";
import { getScoreDistribution } from "@/lib/score-percentile-db";
import { percentileFromDistribution } from "@/lib/score-percentile";
import { renderReportPoster } from "@/lib/report/poster";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 30;

const SESSION_ID_RE = /^[0-9A-Za-z-]{8,128}$/;
const BodySchema = z.object({
    variant: z.enum(["qr", "noqr"]).optional(),
    gender: z.enum(["male", "female"]).optional(),
});

/**
 * POST /api/advisor/reports/[id]/poster
 * 服务端证书海报（sharp）。H5/小程序端侧 canvas 失败时兜底，也可作为统一出图入口。
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            if (await isSubsiteAccountDisabled(request)) return accountDisabledResponse();
            return NextResponse.json({ error: "请先登录" }, { status: 401 });
        }

        const ip = getClientIP(request);
        const limit = await rateLimit(`report-poster-${user.id}-${ip}`, "default", {
            maxRequests: 20,
            windowMs: 60 * 1000,
        });
        if (!limit.success) {
            return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
        }

        const { id: sessionId } = await context.params;
        if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
            return NextResponse.json({ error: "缺少报告参数" }, { status: 400 });
        }

        const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json({ error: "参数错误" }, { status: 400 });
        }

        const session = await prisma.advisorSession.findFirst({
            where: { sessionId, userId: user.id, completedAt: { not: null }, archivedAt: null },
            select: { sessionId: true, completedAt: true, analysisResult: true },
        });
        if (!session) {
            return NextResponse.json({ error: "报告不存在或无权访问" }, { status: 404 });
        }

        const raw = (session.analysisResult || {}) as Record<string, unknown>;
        const result = normalizeAnalysisResult(raw);
        if (!result) {
            return NextResponse.json({ error: "报告尚未生成" }, { status: 404 });
        }
        const faceAnalysis = (raw.faceAnalysis as FaceAnalysisResult | null) || null;

        const persona = result.persona || "guardian";
        const gender = parsed.data.gender
            || faceAnalysis?.gender?.value
            || "female";
        const advice = getSkinTypeByIpKey(persona)?.m7.suggestions
            ?.slice(0, 2)
            .map((item) => item.title);

        let percentile: number | null = null;
        let sampleSize = 0;
        if (typeof faceAnalysis?.overallScore === "number") {
            try {
                const dist = await getScoreDistribution();
                percentile = percentileFromDistribution(dist, Math.round(faceAnalysis.overallScore));
                sampleSize = dist.total;
            } catch (error) {
                logger.warn("[reports/poster] percentile failed", { error: String(error) });
            }
        }

        const buffer = await renderReportPoster({
            persona,
            gender,
            variant: parsed.data.variant ?? "qr",
            nickname: result.nickname || user.name || "用户",
            score: faceAnalysis?.overallScore,
            percentile,
            sampleSize,
            testDate: result.analyzedAt || session.completedAt?.toISOString(),
            reportId: sessionId,
            advice,
        });

        return new NextResponse(buffer as unknown as BodyInit, {
            headers: {
                "Content-Type": "image/png",
                "Content-Disposition": `inline; filename="nihplod-${sessionId}.png"`,
                "Cache-Control": "private, max-age=60",
            },
        });
    } catch (error) {
        logger.error("[reports/poster] failed", { error: String(error) });
        return NextResponse.json({ error: "证书生成失败，请稍后重试" }, { status: 500 });
    }
}
