import { NextRequest, NextResponse } from "next/server";
import { guardInternalUserRequest } from "@/lib/internal-guard";
import { claimGuestSessionsFromClientIp } from "@/lib/guest-session-claim";
import { getTestHistory } from "@/lib/test-history";
import { logger } from "@/lib/logger";

export const maxDuration = 15;

/**
 * 内部接口：测肤记录列表（供主站官网用户中心「护肤档案」调用）
 *
 * GET /api/internal/test-history?userId=&page=&limit=&lite=1&before=<ISO>&clientIp=
 *   → { history, pagination }
 *
 * clientIp 由官网 BFF 传入（HMAC 通道内，代表用户真实 IP）：用于游客会话
 * 懒认领，与子站公共路由行为一致；缺失/非法时跳过认领，不影响读取。
 */
export async function GET(request: NextRequest) {
    const guard = await guardInternalUserRequest(request, { scope: "test-history" });
    if (guard.error) return guard.error;

    try {
        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10) || 10));
        const lite = searchParams.get("lite") === "1";
        const beforeRaw = searchParams.get("before");
        const before = beforeRaw ? new Date(beforeRaw) : null;

        // 游客测肤懒认领（best-effort）：仅首屏（无游标且第一页）触发——
        // 翻页请求重复认领没有意义，白付一次查询
        if (!beforeRaw && page <= 1) {
            await claimGuestSessionsFromClientIp(guard.userId, searchParams.get("clientIp"));
        }

        const result = await getTestHistory(guard.userId, { page, limit, lite, before });
        return NextResponse.json(result);
    } catch (error) {
        logger.error("[internal/test-history] fetch failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
