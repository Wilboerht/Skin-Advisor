/**
 * 设置密码（微信用户首次创建密码，代理到官网）
 * POST /api/user/password/set
 */
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { getSession } from "@/lib/auth";
import { callOfficialApi, type OfficialApiResponse } from "@/lib/official-api";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return apiError(ErrorCode.UNAUTHORIZED, "请先登录", 401);
        }

        const body = await req.json();

        const cookieStore = await cookies();
        const officialCookieNames = ["__Host-user_token", "__Host-user_refresh_token", "user_token", "user_refresh_token", "__Host-csrf_token", "csrf_token"];
        const allCookies = cookieStore.getAll()
            .filter(c => officialCookieNames.includes(c.name))
            .map(c => `${c.name}=${c.value}`).join('; ');

        const result = await callOfficialApi<OfficialApiResponse<{ message: string }>>({
            method: "POST",
            path: "/api/user/password/set",
            body,
            cookies: allCookies,
            requireSignature: false,
            timeoutMs: 15000,
        });

        if (!result) {
            return apiError(ErrorCode.UPSTREAM_ERROR, "上游服务暂时不可用", 502);
        }

        if (!result.ok || !result.data?.success) {
            return NextResponse.json(
                { success: false, error: result.data?.error || { code: ErrorCode.UPSTREAM_ERROR, message: "密码设置失败" } },
                { status: result.status || 400 }
            );
        }

        return NextResponse.json(result.data);
    } catch (error) {
        logger.error("[user/password/set] Proxy error:", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "服务器内部错误", 500);
    }
}
