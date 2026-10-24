import { NextRequest, NextResponse } from "next/server";
import { guardInternalUserRequest } from "@/lib/internal-guard";
import { getAdminUserReportDetail } from "@/lib/admin-user-reports";
import { logger } from "@/lib/logger";

export const maxDuration = 15;
export const dynamic = "force-dynamic";

const SESSION_ID_RE = /^[0-9A-Za-z-]{8,128}$/;

/**
 * 内部接口：管理端用户完整测肤报告
 * GET /api/internal/admin/user-report?userId=&sessionId=
 */
export async function GET(request: NextRequest) {
    const guard = await guardInternalUserRequest(request, {
        scope: "admin-user-report",
        maxRequests: 60,
    });
    if (guard.error) return guard.error;

    const sessionId = request.nextUrl.searchParams.get("sessionId") || "";
    if (!SESSION_ID_RE.test(sessionId)) {
        return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    try {
        const data = await getAdminUserReportDetail(guard.userId, sessionId);
        if (!data) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data });
    } catch (error) {
        logger.error("[internal/admin/user-report] failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
