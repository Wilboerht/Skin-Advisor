import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalRequest } from "@/lib/internal-api";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { getAdminFunnelSummary } from "@/lib/admin-funnel";
import { getAdminReportQualitySummary } from "@/lib/admin-report-quality";
import { getAdminAICostSummary } from "@/lib/admin-ai-costs";
import { logger } from "@/lib/logger";

export const maxDuration = 15;
export const dynamic = "force-dynamic";

type AnalyticsSection = "funnel" | "reportQuality" | "aiCosts";

/**
 * 内部接口：测肤子站管理端摘要（供主站控制中台概览卡片调用）
 *
 * GET /api/internal/admin/analytics
 *   → { success, data: { funnel, reportQuality, aiCosts, failed, generatedAt } }
 *
 * - 系统级接口，无 userId；HMAC 验签 + IP 限流
 * - 单个板块失败时返回 null，其余板块继续返回
 */
export async function GET(request: NextRequest) {
    const auth = await authorizeInternalRequest(request, {
        legacy: "bearer-advisor-secret",
    });
    if (!auth.ok) {
        const message =
            auth.reason === "advisor_secret_not_configured"
                ? "ADVISOR_INTERNAL_SECRET not configured"
                : "Unauthorized";
        return NextResponse.json({ error: message }, { status: auth.status ?? 401 });
    }

    const ip = getClientIP(request);
    const ipLimit = await rateLimit(`internal-admin-analytics-ip-${ip}`, "default", {
        maxRequests: 60,
        windowMs: 60 * 1000,
    });
    if (!ipLimit.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const [funnelResult, qualityResult, costResult] = await Promise.allSettled([
        getAdminFunnelSummary(),
        getAdminReportQualitySummary(),
        getAdminAICostSummary("week"),
    ]);

    const failed: AnalyticsSection[] = [];
    if (funnelResult.status === "rejected") {
        failed.push("funnel");
        logger.warn("[internal/admin/analytics] funnel unavailable", {
            error: String(funnelResult.reason),
        });
    }
    if (qualityResult.status === "rejected") {
        failed.push("reportQuality");
        logger.warn("[internal/admin/analytics] report quality unavailable", {
            error: String(qualityResult.reason),
        });
    }
    if (costResult.status === "rejected") {
        failed.push("aiCosts");
        logger.warn("[internal/admin/analytics] AI costs unavailable", {
            error: String(costResult.reason),
        });
    }

    return NextResponse.json(
        {
            success: true,
            data: {
                funnel: funnelResult.status === "fulfilled" ? funnelResult.value : null,
                reportQuality:
                    qualityResult.status === "fulfilled" ? qualityResult.value : null,
                aiCosts: costResult.status === "fulfilled" ? costResult.value : null,
                failed,
                generatedAt: new Date().toISOString(),
            },
        },
        { headers: { "Cache-Control": "no-store" } }
    );
}
