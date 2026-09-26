import { NextRequest, NextResponse } from "next/server";
import { guardInternalUserRequest } from "@/lib/internal-guard";
import { claimGuestSessionsFromClientIp } from "@/lib/guest-session-claim";
import { getDiaryArchive } from "@/lib/diary-service";
import { logger } from "@/lib/logger";

export const maxDuration = 15;

/**
 * 内部接口：护肤档案首屏聚合（供主站官网用户中心「护肤档案」调用）
 *
 * GET /api/internal/diary/archive?userId=&limit=&clientIp=
 *   → { success, data: 条目[], pagination, summary }
 *
 * summary 口径与子站里程碑完全一致（连续/累计打卡、测肤次数）。
 * clientIp 由官网 BFF 传入：先做游客会话懒认领再取聚合（缺失/非法则跳过）。
 */
export async function GET(request: NextRequest) {
    const guard = await guardInternalUserRequest(request, { scope: "diary-read" });
    if (guard.error) return guard.error;

    try {
        const { searchParams } = new URL(request.url);
        await claimGuestSessionsFromClientIp(guard.userId, searchParams.get("clientIp"));

        const archive = await getDiaryArchive(guard.userId, searchParams.get("limit"));
        return NextResponse.json({
            success: true,
            data: archive.entries,
            pagination: archive.pagination,
            summary: archive.summary,
        });
    } catch (error) {
        logger.error("[internal/diary/archive] fetch failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
