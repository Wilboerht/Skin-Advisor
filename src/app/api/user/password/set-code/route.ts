/**
 * 设置密码 - 发送短信验证码（代理官网 POST /api/auth/send-code，type=reset）
 * POST /api/user/password/set-code
 *
 * 前端不传手机号：会话里的手机号可能是官网 userinfo 返回的打码值，不能用于发码；
 * 此处从本地用户副本解析完整手机号，并以 Bearer 转发（官网对「Bearer + 手机号归属本人」豁免 CSRF）。
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { getSessionUser, SSO_BASE_URL } from "@/lib/sso-auth";
import { resolveOfficialAccessToken } from "@/lib/account-bff";
import { logger } from "@/lib/logger";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

const UPSTREAM_TIMEOUT_MS = 15000;

export async function POST(req: NextRequest) {
    try {
        const ip = getClientIP(req);
        // 发短信有成本：IP + 用户双重限流（官网侧另有 60s 间隔 / 每小时 5 次）
        const ipLimit = await rateLimit(`password-set-code-ip-${ip}`, "login", { maxRequests: 5, windowMs: 15 * 60 * 1000 });
        if (!ipLimit.success) {
            return apiError(ErrorCode.RATE_LIMITED, "验证码发送过于频繁，请稍后再试", 429);
        }

        const session = await getSessionUser(req);
        if (!session) {
            return apiError(ErrorCode.UNAUTHORIZED, "请先登录", 401);
        }

        const userLimit = await rateLimit(`password-set-code-user-${session.id}`, "login", { maxRequests: 3, windowMs: 15 * 60 * 1000 });
        if (!userLimit.success) {
            return apiError(ErrorCode.RATE_LIMITED, "验证码发送过于频繁，请稍后再试", 429);
        }

        // 与其它账号 BFF 一致：access token 过期时用 refresh cookie 静默轮换，避免"登录已过期"误报
        const token = await resolveOfficialAccessToken(req);
        if (!token) {
            return apiError(ErrorCode.UNAUTHORIZED, "登录已过期，请重新登录", 401);
        }

        // 完整手机号只在本地副本（登录时由 SSO 同步落库）；打码号码不能用于发码
        const local = await prisma.user.findUnique({
            where: { id: session.id },
            select: { phoneNumber: true },
        });
        const phone = local?.phoneNumber;
        if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
            return NextResponse.json(
                { success: false, error: { code: "PHONE_NOT_BOUND", message: "账号未绑定手机号，无法发送验证码" } },
                { status: 400 }
            );
        }

        const res = await fetch(`${SSO_BASE_URL}/api/auth/send-code`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ phone, type: "reset" }),
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });

        const data = (await res.json().catch(() => null)) as
            | { success?: boolean; error?: { code?: string; message?: string } }
            | null;

        if (!res.ok || !data?.success) {
            return NextResponse.json(
                data ?? { success: false, error: { code: ErrorCode.UPSTREAM_ERROR, message: "验证码发送失败" } },
                { status: res.status || 502 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        logger.error("[user/password/set-code] Proxy error:", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "服务器内部错误", 500);
    }
}
