/**
 * 修改密码（BFF 代理官网 OAuth 资源端点 /api/oauth/user/password，Bearer 转发）
 * PUT /api/user/password
 *
 * 旧密码校验与凭证变更收尾由官网完成；成功后官网撤销全部 OAuth 会话并向本站
 * 发送 backchannel logout（账号凭证变更的安全口径），本站用户需重新登录。
 * 唯一例外：官网不可达时返回 502，前端提示稍后重试。
 */
import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { authorizeAccountBff, proxyOfficialJson } from "@/lib/account-bff-proxy";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

// 官网改密成功后会等待 backchannel 通知（最坏约 12s，见主站 backchannel-logout：
// 2 次 ×5s 超时 + 2s 退避），超时留足余量避免误报失败
const UPSTREAM_TIMEOUT_MS = 25000;

export async function PUT(req: NextRequest) {
    const ip = getClientIP(req);
    const ipLimit = await rateLimit(`password-change-${ip}`, "login", { maxRequests: 5, windowMs: 15 * 60 * 1000 });
    if (!ipLimit.success) {
        return apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
    }

    const auth = await authorizeAccountBff(req, { scope: "password-change" });
    if (auth.error) return auth.error;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return apiError(ErrorCode.VALIDATION_ERROR, "请求体不是合法的 JSON", 400);
    }

    return proxyOfficialJson({
        token: auth.token,
        path: "/api/oauth/user/password",
        method: "PUT",
        body: JSON.stringify(body),
        timeoutMs: UPSTREAM_TIMEOUT_MS,
    });
}
