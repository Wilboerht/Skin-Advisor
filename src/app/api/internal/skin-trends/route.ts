import { NextRequest, NextResponse } from "next/server";
import { guardInternalUserRequest } from "@/lib/internal-guard";
import { claimGuestSessionsFromClientIp } from "@/lib/guest-session-claim";
import { getSkinTrends } from "@/lib/skin-trends";
import { logger } from "@/lib/logger";

export const maxDuration = 15;

/**
 * 内部接口：肌肤评分趋势（供主站官网用户中心「护肤档案」调用）
 *
 * GET /api/internal/skin-trends?userId=&clientIp=
 *   → { success, data: { dates, scores, dimensions } | null }
 *   data=null 表示有效样本不足 2 次（官网走解锁引导）。
 *
 * clientIp 由官网 BFF 传入：先做游客会话懒认领再取趋势，
 * 避免刚归户的历史测肤被趋势遗漏（缺失/非法则跳过）。
 */
export async function GET(request: NextRequest) {
    const guard = await guardInternalUserRequest(request, { scope: "skin-trends" });
    if (guard.error) return guard.error;

    try {
        const { searchParams } = new URL(request.url);
        await claimGuestSessionsFromClientIp(guard.userId, searchParams.get("clientIp"));

        const trends = await getSkinTrends(guard.userId);
        return NextResponse.json({ success: true, data: trends });
    } catch (error) {
        logger.error("[internal/skin-trends] fetch failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
