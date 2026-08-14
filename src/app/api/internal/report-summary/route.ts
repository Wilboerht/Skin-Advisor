import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { extractReportSummary } from "@/lib/internal-report";
import { logger } from "@/lib/logger";

const SESSION_ID_RE = /^[0-9A-Za-z-]{8,128}$/;

function safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

/**
 * 内部接口：按 sessionId 返回测肤报告摘要。
 * 仅供企业微信 AI 客服服务调用（x-internal-key 校验），
 * 返回字段最小化，不包含人脸图片等敏感数据。
 */
export async function GET(request: NextRequest) {
    const internalKey = process.env.INTERNAL_API_KEY;
    const providedKey = request.headers.get("x-internal-key") || "";

    if (!internalKey || !providedKey || !safeCompare(internalKey, providedKey)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get("sessionId") || "";
    if (!SESSION_ID_RE.test(sessionId)) {
        return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    try {
        const session = await prisma.advisorSession.findUnique({
            where: { sessionId },
            select: { analysisResult: true, answers: true, expiresAt: true },
        });

        if (!session?.analysisResult) {
            return NextResponse.json({ found: false }, { status: 404 });
        }
        if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
            return NextResponse.json({ found: false }, { status: 404 });
        }

        const summary = extractReportSummary(session.analysisResult, sessionId, session.answers);
        if (!summary.found) {
            return NextResponse.json({ found: false }, { status: 404 });
        }
        return NextResponse.json(summary);
    } catch (error) {
        logger.error("report-summary failed", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
