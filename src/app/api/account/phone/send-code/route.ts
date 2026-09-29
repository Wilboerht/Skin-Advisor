/**
 * 换绑手机号 - 发送验证码（BFF 代理官网 OAuth 资源端点）
 * POST /api/account/phone/send-code
 *
 * 前端只传 target / newPhone；身份与手机号归属由官网按 OAuth Bearer token 解析，
 * 本路由不接触完整手机号。发短信有成本：IP 限流 + 用户级限流
 *（官网侧另有 60 秒间隔 / 每小时 5 次）。
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { authorizeAccountBff, proxyOfficialJson } from "@/lib/account-bff-proxy";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

const bodySchema = z.discriminatedUnion("target", [
    z.object({ target: z.literal("current") }),
    z.object({
        target: z.literal("new"),
        newPhone: z.string().regex(/^1[3-9]\d{9}$/, "请输入正确的手机号"),
    }),
]);

export async function POST(req: NextRequest) {
    // IP 限流先于鉴权：未登录/伪造会话也不能刷短信
    const ip = getClientIP(req);
    const ipLimit = await rateLimit(`phone-rebind-code-ip-${ip}`, "login", { maxRequests: 5, windowMs: 15 * 60 * 1000 });
    if (!ipLimit.success) {
        return apiError(ErrorCode.RATE_LIMITED, "验证码发送过于频繁，请稍后再试", 429);
    }

    // 用户级限流（3 次 / 15 分钟）+ 会话鉴权 + 官网 token
    const auth = await authorizeAccountBff(req, {
        scope: "phone-rebind-code",
        maxRequests: 3,
        windowMs: 15 * 60 * 1000,
    });
    if (auth.error) return auth.error;

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return apiError(ErrorCode.VALIDATION_ERROR, parsed.error.issues[0]?.message || "参数错误", 400);
    }

    return proxyOfficialJson({
        token: auth.token,
        path: "/api/oauth/phone/send-code",
        method: "POST",
        body: JSON.stringify(parsed.data),
        timeoutMs: 15000,
    });
}
