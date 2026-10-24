import { NextRequest, NextResponse } from "next/server";
import { guardInternalUserRequest } from "@/lib/internal-guard";
import { listAdminUserReports } from "@/lib/admin-user-reports";
import { logger } from "@/lib/logger";

export const maxDuration = 15;
export const dynamic = "force-dynamic";

/**
 * 内部接口：管理端用户报告列表（仅摘要）
 * GET /api/internal/admin/user-reports?userId=&page=&limit=
 */
export async function GET(request: NextRequest) {
    const guard = await guardInternalUserRequest(request, {
        scope: "admin-user-reports",
        maxRequests: 120,
    });
    if (guard.error) return guard.error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
        50,
        Math.max(1, parseInt(searchParams.get("limit") || "10", 10) || 10)
    );

    try {
        const data = await listAdminUserReports(guard.userId, { page, limit });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        logger.error("[internal/admin/user-reports] failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
