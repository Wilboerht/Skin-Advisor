import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalRequest } from "@/lib/internal-api";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { getAdvisorDashboardStats } from "@/lib/admin-dashboard-stats";
import { getAdvisorAIHealth } from "@/lib/admin-ai-health";
import { logger } from "@/lib/logger";

export const maxDuration = 15;
export const dynamic = "force-dynamic";

/**
 * 内部接口：测肤子站管理端概览（供主站控制中台调用）
 *
 * GET /api/internal/admin/dashboard
 *   → { success, data: { overview, skinTypeDistribution, weeklyGrowth, health, generatedAt } }
 *
 * - 系统级接口，无 userId；HMAC 验签 + IP 限流
 * - health 失败时降级为 null，不阻断统计
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
    const ipLimit = await rateLimit(`internal-admin-dashboard-ip-${ip}`, "default", {
        maxRequests: 60,
        windowMs: 60 * 1000,
    });
    if (!ipLimit.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const [statsResult, healthResult] = await Promise.allSettled([
            getAdvisorDashboardStats(),
            getAdvisorAIHealth(),
        ]);

        if (statsResult.status === "rejected") {
            throw statsResult.reason;
        }
        if (healthResult.status === "rejected") {
            logger.warn("[internal/admin/dashboard] AI health unavailable", {
                error: String(healthResult.reason),
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                ...statsResult.value,
                health: healthResult.status === "fulfilled" ? healthResult.value : null,
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error("[internal/admin/dashboard] failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
