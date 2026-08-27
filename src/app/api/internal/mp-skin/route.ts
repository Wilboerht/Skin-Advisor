import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { extractReportSummary } from "@/lib/internal-report";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

/**
 * 内部接口：按手机号返回微信小程序「肌肤档案」所需的测肤数据。
 * 仅供 NIHPLOD 商城服务端调用（x-internal-key 校验，复用 INTERNAL_API_KEY），
 * 一次返回最新报告摘要、趋势数据与历史分页，减少跨系统往返。
 */

const PHONE_RE = /^1[3-9]\d{9}$/;

function safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

interface TrendDimension {
    score?: number;
}

interface TrendFaceAnalysis {
    overallScore?: number;
    dimensions?: {
        wrinkles?: TrendDimension;
        waterOil?: TrendDimension;
        spots?: TrendDimension;
        texture?: TrendDimension;
    };
}

const asFaceAnalysis = (result: unknown): TrendFaceAnalysis | undefined =>
    (result as { faceAnalysis?: TrendFaceAnalysis } | null | undefined)?.faceAnalysis;

export async function GET(request: NextRequest) {
    const internalKey = process.env.INTERNAL_API_KEY;
    const providedKey = request.headers.get("x-internal-key") || "";

    if (!internalKey || !providedKey || !safeCompare(internalKey, providedKey)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const phone = request.nextUrl.searchParams.get("phone") || "";
    if (!PHONE_RE.test(phone)) {
        return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
    }

    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(20, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "10", 10) || 10));

    // 限流分两层：
    // 1. IP 级宽松兜底（防密钥泄漏后被批量滥用）；
    // 2. 手机号级细粒度配额——商城服务端出口是同一 IP，若按 IP 计数所有用户会共享配额。
    const ip = getClientIP(request);
    const ipLimitResult = await rateLimit(`internal-mp-skin-ip-${ip}`, "default", { maxRequests: 300, windowMs: 60 * 1000 });
    if (!ipLimitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const phoneLimitResult = await rateLimit(`internal-mp-skin-phone-${phone}`, "advisor");
    if (!phoneLimitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { phoneNumber: phone },
            select: { id: true },
        });

        if (!user) {
            return NextResponse.json({ linked: false });
        }

        const historyWhere = {
            userId: user.id,
            completedAt: { not: null },
            archivedAt: null, // 冷层归档摘要对用户不可见
        };

        const [recentSessions, total] = await Promise.all([
            // 取足够覆盖首页展示的量：最新 5 条用于趋势，历史第 1 页最多 20 条
            prisma.advisorSession.findMany({
                where: historyWhere,
                orderBy: { completedAt: "desc" },
                select: {
                    sessionId: true,
                    completedAt: true,
                    expiresAt: true,
                    answers: true,
                    analysisResult: true,
                },
                take: Math.max(5, (page - 1) * pageSize + pageSize),
            }),
            prisma.advisorSession.count({ where: historyWhere }),
        ]);

        if (recentSessions.length === 0) {
            return NextResponse.json({
                linked: true,
                latest: null,
                trends: null,
                history: [],
                pagination: { page, limit: pageSize, total: 0, totalPages: 0 },
            });
        }

        // ===== 最新报告摘要 =====
        const latestSession = recentSessions[0];
        const latestSummary = extractReportSummary(
            latestSession.analysisResult,
            latestSession.sessionId,
            latestSession.answers
        );
        const latest = latestSummary.found
            ? {
                ...latestSummary,
                completedAt: latestSession.completedAt?.toISOString() ?? null,
                expiresAt: latestSession.expiresAt?.toISOString() ?? null,
            }
            : null;

        // ===== 趋势：最近 5 次（时间正序），缺失维度用 null 表示断线而非 0 分 =====
        const trendSessions = recentSessions.slice(0, 5).reverse();
        const trends = trendSessions.length >= 2
            ? {
                dates: trendSessions.map(s => s.completedAt?.toISOString() ?? ""),
                scores: trendSessions.map(s => asFaceAnalysis(s.analysisResult)?.overallScore ?? null),
                dimensions: {
                    wrinkles: trendSessions.map(s => asFaceAnalysis(s.analysisResult)?.dimensions?.wrinkles?.score ?? null),
                    waterOil: trendSessions.map(s => asFaceAnalysis(s.analysisResult)?.dimensions?.waterOil?.score ?? null),
                    spots: trendSessions.map(s => asFaceAnalysis(s.analysisResult)?.dimensions?.spots?.score ?? null),
                    texture: trendSessions.map(s => asFaceAnalysis(s.analysisResult)?.dimensions?.texture?.score ?? null),
                },
            }
            : null;

        // ===== 历史分页（轻量字段） =====
        const historyItems = recentSessions
            .slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
            .map(s => {
                const summary = extractReportSummary(s.analysisResult, s.sessionId, s.answers);
                return {
                    sessionId: s.sessionId,
                    completedAt: s.completedAt?.toISOString() ?? null,
                    overallScore: summary.found ? summary.overallScore ?? null : null,
                    skinTypeLabel: summary.found ? summary.skinTypeLabel ?? null : null,
                };
            });

        return NextResponse.json({
            linked: true,
            latest,
            trends,
            history: historyItems,
            pagination: {
                page,
                limit: pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    } catch (error) {
        logger.error("internal mp-skin failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
