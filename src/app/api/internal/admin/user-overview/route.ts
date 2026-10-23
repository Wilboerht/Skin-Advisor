import { NextRequest, NextResponse } from "next/server";
import { guardInternalUserRequest } from "@/lib/internal-guard";
import { getAdminUserOverview } from "@/lib/admin-user-overview";
import { logger } from "@/lib/logger";

export const maxDuration = 15;

const MEMBERSHIP_LEVELS = new Set(["REGULAR", "SILVER", "GOLD", "DIAMOND"]);

/**
 * 内部接口：管理端用户测肤概览（供主站控制中台用户详情「测肤档案」调用）
 *
 * GET /api/internal/admin/user-overview?userId=&level=&totalSpent=
 *
 * - userId 为主站 SSO sub，与子站 User.id 相同
 * - level/totalSpent 由主站传入（会员数据权威来源），用于修正子站本地副本滞后
 * - 只返回账号状态、用量、近期摘要；不返回邮箱/手机号/问卷/日记备注
 */
export async function GET(request: NextRequest) {
    const guard = await guardInternalUserRequest(request, {
        scope: "admin-user-overview",
        maxRequests: 120,
    });
    if (guard.error) return guard.error;

    const { searchParams } = new URL(request.url);

    const levelParam = searchParams.get("level") || "";
    const level = MEMBERSHIP_LEVELS.has(levelParam) ? levelParam : undefined;
    const totalSpentRaw = searchParams.get("totalSpent");
    const totalSpentNum =
        totalSpentRaw !== null && totalSpentRaw !== "" ? Number(totalSpentRaw) : NaN;
    const totalSpent =
        Number.isFinite(totalSpentNum) && totalSpentNum >= 0
            ? Math.floor(totalSpentNum)
            : undefined;

    try {
        const overview = await getAdminUserOverview(guard.userId, { level, totalSpent });
        return NextResponse.json({ success: true, data: overview });
    } catch (error) {
        logger.error("[internal/admin/user-overview] failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
