/**
 * 换绑手机号（BFF 代理官网 OAuth 资源端点）
 * PUT /api/account/phone
 *
 * 双验证码核销由官网完成（当前手机 + 新手机，各 6 位短信码）。
 * 成功后官网会撤销全部 OAuth 会话并向本站发送 backchannel logout
 *（账号标识变更的安全口径），本站用户需重新登录；
 * 本地用户副本的手机号同步更新，供资料展示与积分等内部接口使用。
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { authorizeAccountBff, proxyOfficialJson } from "@/lib/account-bff-proxy";
import { logger } from "@/lib/logger";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

// 官网换绑成功后会同步撤销 OAuth 会话并等待 backchannel 通知（最坏约 12s，见主站
// backchannel-logout：2 次 ×5s 超时 + 2s 退避），超时需留足余量，避免"官网已换绑
// 但 BFF 超时"造成前端误报失败
const UPSTREAM_TIMEOUT_MS = 25000;

const bodySchema = z.object({
    newPhone: z.string().regex(/^1[3-9]\d{9}$/, "请输入正确的手机号"),
    // 当前手机验证码：当前为真实手机号时必填（由前端按绑定状态决定是否展示）；
    // 微信占位手机号（wx_ 前缀）账号无短信通道，官网跳过当前验证
    currentCode: z.string().regex(/^\d{6}$/, "当前手机验证码为 6 位数字").optional(),
    newCode: z.string().regex(/^\d{6}$/, "新手机验证码为 6 位数字"),
});

export async function PUT(req: NextRequest) {
    // IP 限流先于鉴权：与官网会话路由同口径（5 次 / 15 分钟），防验证码爆破
    const ip = getClientIP(req);
    const ipLimit = await rateLimit(`phone-rebind-ip-${ip}`, "login", { maxRequests: 5, windowMs: 15 * 60 * 1000 });
    if (!ipLimit.success) {
        return apiError(ErrorCode.RATE_LIMITED, "操作过于频繁，请稍后再试", 429);
    }

    const auth = await authorizeAccountBff(req, {
        scope: "phone-rebind",
        maxRequests: 5,
        windowMs: 15 * 60 * 1000,
    });
    if (auth.error) return auth.error;

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return apiError(ErrorCode.VALIDATION_ERROR, parsed.error.issues[0]?.message || "参数错误", 400);
    }

    const upstream = await proxyOfficialJson({
        token: auth.token,
        path: "/api/oauth/phone",
        method: "PUT",
        body: JSON.stringify(parsed.data),
        timeoutMs: UPSTREAM_TIMEOUT_MS,
    });

    // 官网已换绑成功：同步本地用户副本（资料展示/密码设置等按本地手机号解析）。
    // 官网 OAuth 响应仅回传打码手机号（最小化 PII），本地以请求体新号为准；
    // 本地同步失败不阻断响应——官网为准，下次 SSO 登录/userinfo 回源会纠偏
    if (upstream.ok) {
        try {
            await prisma.user.update({
                where: { id: auth.user.id },
                data: { phoneNumber: parsed.data.newPhone },
            });
        } catch (err) {
            logger.warn("[account/phone] 本地手机号副本同步失败", { userId: auth.user.id, error: String(err) });
        }
    }

    return upstream;
}
