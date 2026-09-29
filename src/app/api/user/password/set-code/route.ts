/**
 * 设置密码 - 发送短信验证码（BFF 代理官网 OAuth 资源端点）
 * POST /api/user/password/set-code
 *
 * 手机号由官网按 OAuth token 所有者解析（即当前账号本人手机号），前端与 BFF
 * 都不接触完整号码，也无需本地用户副本（修复了原实现要求本地存有手机号的问题）。
 * 发短信有成本：IP + 用户双重限流（官网侧另有 60 秒间隔 / 每小时 5 次）。
 */
import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { authorizeAccountBff, proxyOfficialJson } from "@/lib/account-bff-proxy";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
    const ip = getClientIP(req);
    const ipLimit = await rateLimit(`password-set-code-ip-${ip}`, "login", { maxRequests: 5, windowMs: 15 * 60 * 1000 });
    if (!ipLimit.success) {
        return apiError(ErrorCode.RATE_LIMITED, "验证码发送过于频繁，请稍后再试", 429);
    }

    const auth = await authorizeAccountBff(req, {
        scope: "password-set-code",
        maxRequests: 3,
        windowMs: 15 * 60 * 1000,
    });
    if (auth.error) return auth.error;

    return proxyOfficialJson({
        token: auth.token,
        path: "/api/oauth/user/password/send-code",
        method: "POST",
        timeoutMs: 15000,
    });
}
