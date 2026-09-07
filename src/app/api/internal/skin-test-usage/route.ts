import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getSkinTestUsageSummary } from "@/lib/usage-limit";
import { logger } from "@/lib/logger";

export const maxDuration = 15;

/**
 * 内部接口：查询指定用户的测肤用量与会员配额（供主站会员面板调用）
 *
 * 鉴权：Authorization: Bearer <ADVISOR_INTERNAL_SECRET>（与 cron 的 CRON_SECRET 策略一致：
 * 配置了则强校验；未配置时 production 返回 500，dev 放行）。
 *
 * GET /api/internal/skin-test-usage?userId=<主站 sub>
 *
 * 响应示例：
 *   { "level": "SILVER", "totalUsed": 23, "todayUsed": 2,
 *     "quota": { "lifetimeLimit": 50, "dailyLimit": 10, "unlimited": false },
 *     "remaining": 27 }
 * 用户不存在（从未用过子站）：200 + level: null + totalUsed/todayUsed: 0 + 按 REGULAR 档配额。
 */

function safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

export async function GET(request: NextRequest) {
    // 鉴权策略与 cron data-cleanup 保持一致
    const secret = process.env.ADVISOR_INTERNAL_SECRET;
    if (secret) {
        const authHeader = request.headers.get("authorization") || "";
        const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!provided || !safeCompare(secret, provided)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    } else if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
            { error: "ADVISOR_INTERNAL_SECRET not configured" },
            { status: 500 }
        );
    }

    const userId = request.nextUrl.searchParams.get("userId") || "";
    if (!userId || userId.length > 128) {
        return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    try {
        const summary = await getSkinTestUsageSummary(userId);
        return NextResponse.json(summary);
    } catch (error) {
        logger.error("[internal/skin-test-usage] failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
