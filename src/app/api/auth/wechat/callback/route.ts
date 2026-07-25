/**
 * 微信授权回调（子站）
 * GET /api/auth/wechat/callback
 *
 * 处理官网微信回调重定向回来的请求：
 * 1. 读取 URL 中的 wechat_exchange_token；
 * 2. 调用官网内部 API /api/v1/internal/wechat/exchange 兑换登录状态；
 * 3. 若已绑定手机号，设置 Cookie 并重定向到成功页；
 * 4. 若未绑定手机号，重定向到绑定页并保留 exchange token。
 */
import { NextRequest, NextResponse } from "next/server";
import { createSignedInternalApiHeaders } from "@/lib/internal-api";
import { parseOfficialResponse } from "@/lib/official-api";
import { signLocalSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/lib/permissions";
import { logger } from "@/lib/logger";

// 与官网 src/types/auth.ts 保持一致
const USER_COOKIE_NAME = "__Host-user_token";
const USER_REFRESH_COOKIE_NAME = "__Host-user_refresh_token";

const USER_ACCESS_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 15 * 60, // 15 分钟
};

const USER_REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 天
};

export const dynamic = "force-dynamic";

/**
 * 校验重定向目标是否合法：仅允许同域相对路径或已配置的子站域名。
 */
function getSafeRedirect(req: NextRequest, redirect: string | null): string {
    if (!redirect || redirect === "/") return "/";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL;
    const origin = new URL(req.url).origin;

    // 相对路径
    if (redirect.startsWith("/") && !redirect.startsWith("//")) return redirect;

    // 绝对路径：必须匹配当前请求源或配置的子站域名
    try {
        const redirectOrigin = new URL(redirect).origin;
        if (redirectOrigin === origin) return redirect;
        if (siteUrl) {
            const allowedOrigin = new URL(siteUrl).origin;
            if (redirectOrigin === allowedOrigin) return redirect;
        }
    } catch {
        // invalid URL, fall through
    }

    return "/";
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const exchangeToken = searchParams.get("wechat_exchange_token");
    const rawRedirect = searchParams.get("redirect");
    const redirect = getSafeRedirect(req, rawRedirect);
    const wechatAuth = searchParams.get("wechat_auth");

    // 处理微信用户取消授权等错误场景，直接透传回前端
    // 注意：有 exchangeToken 时优先兑换，不要把 token 留在 URL 中
    if (wechatAuth && wechatAuth !== "binding_required" && !exchangeToken) {
        const errorUrl = new URL(redirect, req.url);
        searchParams.forEach((value, key) => {
            if (key !== "redirect") {
                errorUrl.searchParams.set(key, value);
            }
        });
        return NextResponse.redirect(errorUrl, 302);
    }

    if (!exchangeToken) {
        const errorUrl = new URL(redirect, req.url);
        errorUrl.searchParams.set("wechat_auth", "error");
        errorUrl.searchParams.set("code", "MISSING_EXCHANGE_TOKEN");
        errorUrl.searchParams.set("message", encodeURIComponent("缺少微信授权凭证"));
        return NextResponse.redirect(errorUrl, 302);
    }

    try {
        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
        const path = "/api/v1/internal/wechat/exchange";
        const bodyText = JSON.stringify({ wechatExchangeToken: exchangeToken });

        const signed = await createSignedInternalApiHeaders("advisor", "POST", path, bodyText);
        if (!signed) {
            throw new Error("未配置内部 API 密钥");
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const officialResponse = await fetch(`${officialApiUrl}${path}`, {
            method: "POST",
            headers: signed.headers,
            body: bodyText,
            signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        const parsed = await parseOfficialResponse<{
            success: boolean;
            error?: { code: string; message: string };
            data?: {
                user?: { id: string; phone: string; nickname?: string; avatar?: string };
                accessToken?: string;
                refreshToken?: string;
                bindingRequired?: boolean;
                message?: string;
                passwordGenerated?: boolean;
            };
        }>(officialResponse, { requireSignature: false });

        if (!parsed) {
            throw new Error("官网响应签名校验失败或响应无效");
        }

        const data = parsed.data;

        if (!officialResponse.ok || !data.success) {
            const errorUrl = new URL(redirect, req.url);
            errorUrl.searchParams.set("wechat_auth", "error");
            errorUrl.searchParams.set("code", data.error?.code || "EXCHANGE_FAILED");
            errorUrl.searchParams.set("message", encodeURIComponent(data.error?.message || "微信授权兑换失败"));
            return NextResponse.redirect(errorUrl, 302);
        }

        const result = data.data;

        // 需要绑定手机号：将 exchange token 存入 httpOnly 临时 Cookie（避免 URL 泄露），重定向到绑定页
        if (result?.bindingRequired) {
            const bindUrl = new URL("/auth/wechat-bind", req.url);
            bindUrl.searchParams.set("redirect", redirect);
            const bindResponse = NextResponse.redirect(bindUrl, 302);
            bindResponse.cookies.set("__Host-wechat_bind_token", exchangeToken, {
                httpOnly: true,
                secure: true,
                sameSite: "lax" as const,
                path: "/",
                maxAge: 5 * 60, // 5 分钟有效
            });
            return bindResponse;
        }

        if (!result?.user || !result.accessToken || !result.refreshToken) {
            const errorUrl = new URL(redirect, req.url);
            errorUrl.searchParams.set("wechat_auth", "error");
            errorUrl.searchParams.set("code", "INVALID_EXCHANGE_RESPONSE");
            errorUrl.searchParams.set("message", encodeURIComponent("上游响应不完整"));
            return NextResponse.redirect(errorUrl, 302);
        }

        const userPayload = result.user;

        // 同步到本地数据库
        const existingByPhone = await prisma.user.findUnique({ where: { phoneNumber: userPayload.phone } });
        if (existingByPhone && existingByPhone.id !== userPayload.id) {
            logger.warn(`[AUDIT] Phone collision detected (wechat-callback): new user ${userPayload.id} conflicts with existing user ${existingByPhone.id}. Merging old record.`);
            await prisma.user.update({
                where: { id: existingByPhone.id },
                data: { phoneNumber: `merged_${existingByPhone.id}_${userPayload.phone}` }
            });
        }

        const localUser = await prisma.user.upsert({
            where: { id: userPayload.id },
            update: {
                phoneNumber: userPayload.phone,
                name: userPayload.nickname || userPayload.phone,
                avatarUrl: userPayload.avatar || null,
            },
            create: {
                id: userPayload.id,
                phoneNumber: userPayload.phone,
                password: "",
                name: userPayload.nickname || userPayload.phone,
                avatarUrl: userPayload.avatar || null,
                role: UserRole.USER,
                tokenVersion: 0
            }
        });

        const successUrl = new URL(redirect, req.url);
        successUrl.searchParams.set("wechat_auth", "success");
        if (result.passwordGenerated) {
            successUrl.searchParams.set("password_generated", "true");
        }

        const response = NextResponse.redirect(successUrl, 302);

        // 设置官网同款 Cookie，后续代理 /api/user/profile 等接口时可透传
        response.cookies.set(USER_COOKIE_NAME, result.accessToken, USER_ACCESS_COOKIE_OPTIONS);
        response.cookies.set(USER_REFRESH_COOKIE_NAME, result.refreshToken, USER_REFRESH_COOKIE_OPTIONS);

        // 立即签发子站本地 session
        await signLocalSession(response, {
            id: localUser.id,
            email: null,
            phone: localUser.phoneNumber,
            name: localUser.name,
            role: localUser.role,
            tokenVersion: localUser.tokenVersion,
            dailyTestLimit: localUser.dailyTestLimit,
        });

        return response;

    } catch (error) {
        logger.error("[WechatCallback] 处理微信授权回调失败", { error: String(error) });
        const errorUrl = new URL(redirect, req.url);
        errorUrl.searchParams.set("wechat_auth", "error");
        errorUrl.searchParams.set("code", "INTERNAL_ERROR");
        errorUrl.searchParams.set("message", encodeURIComponent("服务器内部错误"));
        return NextResponse.redirect(errorUrl, 302);
    }
}
