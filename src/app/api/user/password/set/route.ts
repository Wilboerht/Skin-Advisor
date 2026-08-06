/**
 * 设置密码（微信用户首次创建密码，代理到官网）
 * POST /api/user/password/set
 */
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { getSessionUser, getAccessToken } from "@/lib/sso-auth";
import { logger } from "@/lib/logger";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_BASE_URL || "https://nihplod.cn";

export async function POST(req: NextRequest) {
    try {
        const ip = getClientIP(req);
        const ipLimit = await rateLimit(`password-set-${ip}`, "login", { maxRequests: 5, windowMs: 15 * 60 * 1000 });
        if (!ipLimit.success) {
            return apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
        }

        const session = await getSessionUser(req);
        if (!session) {
            return apiError(ErrorCode.UNAUTHORIZED, "请先登录", 401);
        }

        const token = await getAccessToken(req);
        if (!token) {
            return apiError(ErrorCode.UNAUTHORIZED, "登录已过期，请重新登录", 401);
        }

        const body = await req.json();

        if (!body.password) {
            return apiError(ErrorCode.VALIDATION_ERROR, "请提供新密码", 400);
        }

        const res = await fetch(`${SSO_BASE_URL}/api/user/password/set`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        const data = (await res.json().catch(() => ({ success: false, error: { message: "上游响应异常" } }))) as { success?: boolean; error?: { message?: string } };

        if (!res.ok || !data?.success) {
            return NextResponse.json(
                { success: false, error: data?.error || { code: ErrorCode.UPSTREAM_ERROR, message: "密码设置失败" } },
                { status: res.status || 400 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        logger.error("[user/password/set] Proxy error:", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "服务器内部错误", 500);
    }
}
