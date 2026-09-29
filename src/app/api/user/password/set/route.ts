/**
 * 设置密码（BFF 代理官网 OAuth 资源端点 /api/oauth/user/password/set，Bearer 转发）
 * POST /api/user/password/set
 *
 * 短信验证码校验与凭证变更收尾由官网完成；成功后官网撤销全部 OAuth 会话并向
 * 本站发送 backchannel logout，本站用户需重新登录。
 */
import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { authorizeAccountBff, proxyOfficialJson } from "@/lib/account-bff-proxy";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

const UPSTREAM_TIMEOUT_MS = 25000;

export async function POST(req: NextRequest) {
    const ip = getClientIP(req);
    const ipLimit = await rateLimit(`password-set-${ip}`, "login", { maxRequests: 5, windowMs: 15 * 60 * 1000 });
    if (!ipLimit.success) {
        return apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
    }

    // 与官网会话路由同口径：每用户每小时 10 次
    const auth = await authorizeAccountBff(req, {
        scope: "password-set",
        maxRequests: 10,
        windowMs: 60 * 60 * 1000,
    });
    if (auth.error) return auth.error;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return apiError(ErrorCode.VALIDATION_ERROR, "请求体不是合法的 JSON", 400);
    }

    return proxyOfficialJson({
        token: auth.token,
        path: "/api/oauth/user/password/set",
        method: "POST",
        body: JSON.stringify(body),
        timeoutMs: UPSTREAM_TIMEOUT_MS,
    });
}
