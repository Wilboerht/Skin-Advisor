/**
 * Token 刷新 API
 * POST /api/auth/refresh
 *
 * 使用 Refresh Token (httpOnly Cookie) 获取新的 Access Token + Refresh Token。
 * 当 Access Token 过期时，客户端自动调用此接口。
 *
 * 安全：Refresh Token 轮转（Rotation），每次刷新后旧 token 立即撤销。
 * 重用检测：若已撤销的 refresh token 被使用，撤销该用户所有 refresh token。
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_REFRESH_COOKIE_NAME } from "@/lib/auth-config";
import { refreshSession } from "@/lib/auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    // 速率限制：每 5 分钟最多 10 次刷新
    const ip = getClientIP(req);
    const ipLimit = await rateLimit(`refresh-ip-${ip}`, "login", { maxRequests: 10, windowMs: 5 * 60 * 1000 });
    if (!ipLimit.success) {
        return NextResponse.json(
            { error: "请求过于频繁，请稍后再试" },
            { status: 429 }
        );
    }

    try {
        const cookieStore = await cookies();
        const refreshToken = cookieStore.get(AUTH_REFRESH_COOKIE_NAME)?.value;

        if (!refreshToken) {
            return NextResponse.json(
                { error: "未找到 Refresh Token，请重新登录" },
                { status: 401 }
            );
        }

        const response = NextResponse.json({ success: true });
        const user = await refreshSession(response, refreshToken);

        if (!user) {
            // 刷新失败，清除所有认证 Cookie
            response.cookies.delete(AUTH_REFRESH_COOKIE_NAME);
            response.cookies.delete(process.env.NODE_ENV === "production" ? "__Host-auth_token" : "auth_token");
            return NextResponse.json(
                { error: "Refresh Token 已失效，请重新登录" },
                { status: 401 }
            );
        }

        return response;
    } catch (e) {
        logger.error("Refresh Token Error", e);
        return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
    }
}
