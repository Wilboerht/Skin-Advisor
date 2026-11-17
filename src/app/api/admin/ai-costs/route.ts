/**
 * Admin AI Cost Dashboard API
 * GET /api/admin/ai-costs - AI 调用成本统计
 * 提供周期内的成本、Token 消耗、成功率等关键指标
 */

import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { getAdminAICostData } from "@/lib/admin-ai-costs";

export const GET = withAdminAuth(async (request: NextRequest) => {
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-ai-costs-${ip}`, "default", {
        maxRequests: 30,
        windowMs: 60 * 1000,
    });
    if (!limitResult.success) {
        return NextResponse.json(
            { error: "请求过于频繁，请稍后再试。" },
            { status: 429 }
        );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "today";
    const provider = searchParams.get("provider") || undefined;

    try {
        const data = await getAdminAICostData(period, provider);
        return NextResponse.json(data);
    } catch (error) {
        logger.error("[Admin AI Costs] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch AI cost data" },
            { status: 500 }
        );
    }
});
