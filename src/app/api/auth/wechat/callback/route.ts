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
import { fetchOfficialMembershipLevel } from "@/lib/official-membership";
import { signLocalSession } from "@/lib/auth";
import { clearSsoSessionCookies } from "@/lib/sso-auth";
import {
    USER_COOKIE_NAME,
    USER_REFRESH_COOKIE_NAME,
    USER_ACCESS_COOKIE_OPTIONS,
    USER_REFRESH_COOKIE_OPTIONS,
    WECHAT_BIND_COOKIE_NAME,
    WECHAT_OAUTH_NONCE_COOKIE_NAME,
    WECHAT_OAUTH_NONCE_COOKIE_OPTIONS,
} from "@/lib/wechat-constants";
import prisma from "@/lib/prisma";
import { UserRole } from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { getPublicOrigin, SSO_INSECURE_LOCAL_DEV } from "@/lib/sso-config";
import { isSafeInternalPath } from "@/lib/url-utils";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * 校验重定向目标是否合法：仅允许同域相对路径或已配置的子站域名。
 */
function getSafeRedirect(req: NextRequest, redirect: string | null): string {
    if (!redirect || redirect === "/") return "/";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL;
    // standalone 部署下 req.url 是进程监听地址（如 http://0.0.0.0:3002），
    // 同源判定必须基于公网 origin
    const origin = getPublicOrigin() || new URL(req.url).origin;

    // 相对路径（统一走 isSafeInternalPath：额外拒绝 "/\..." 这类 WHATWG 规范化绕过）
    if (isSafeInternalPath(redirect)) return redirect;

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

    // 重定向基准取站点公网 origin：standalone 部署下 req.url 是进程监听地址
    //（如 http://0.0.0.0:3002），直接用它会把浏览器重定向到不可达地址
    const siteOrigin = getPublicOrigin() || new URL(req.url).origin;

    const buildErrorRedirect = (code: string, message: string) => {
        const errorUrl = new URL(redirect, siteOrigin);
        errorUrl.searchParams.set("wechat_auth", "error");
        errorUrl.searchParams.set("code", code);
        errorUrl.searchParams.set("message", encodeURIComponent(message));
        return NextResponse.redirect(errorUrl, 302);
    };

    // 浏览器绑定 nonce：用于证明回调 URL 与发起登录的是同一浏览器。
    // 消费后立即清除，避免重放。
    const oauthNonce = req.cookies.get(WECHAT_OAUTH_NONCE_COOKIE_NAME)?.value;
    const consumeNonce = (response: NextResponse) => {
        if (exchangeToken) {
            response.cookies.set(WECHAT_OAUTH_NONCE_COOKIE_NAME, "", {
                ...WECHAT_OAUTH_NONCE_COOKIE_OPTIONS,
                maxAge: 0,
            });
        }
        return response;
    };

    // 回调会触发官网内部兑换调用，按 IP 限流，防止交换 token 被批量重试
    const ip = getClientIP(req);
    const limit = await rateLimit(`wechat-callback-ip-${ip}`, "default", {
        maxRequests: 30,
        windowMs: 60 * 1000,
    });
    if (!limit.success) {
        return buildErrorRedirect("RATE_LIMITED", "请求过于频繁，请稍后再试");
    }

    // 处理微信用户取消授权等错误场景，直接透传回前端
    // 注意：有 exchangeToken 时优先兑换，不要把 token 留在 URL 中
    if (wechatAuth && wechatAuth !== "binding_required" && !exchangeToken) {
        const errorUrl = new URL(redirect, siteOrigin);
        searchParams.forEach((value, key) => {
            if (key !== "redirect") {
                errorUrl.searchParams.set(key, value);
            }
        });
        return NextResponse.redirect(errorUrl, 302);
    }

    if (!exchangeToken) {
        const errorUrl = new URL(redirect, siteOrigin);
        errorUrl.searchParams.set("wechat_auth", "error");
        errorUrl.searchParams.set("code", "MISSING_EXCHANGE_TOKEN");
        errorUrl.searchParams.set("message", encodeURIComponent("缺少微信授权凭证"));
        return NextResponse.redirect(errorUrl, 302);
    }

    // 浏览器绑定校验：只有 exchange token、没有发起登录时写入的 nonce Cookie，
    // 说明该回调 URL 可能是他人（攻击者）转发给当前浏览器的，拒绝兑换（登录 CSRF 防护）。
    if (!oauthNonce) {
        return buildErrorRedirect("MISSING_OAUTH_STATE", "登录会话已失效，请重新发起微信登录");
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
            const errorUrl = new URL(redirect, siteOrigin);
            errorUrl.searchParams.set("wechat_auth", "error");
            errorUrl.searchParams.set("code", data.error?.code || "EXCHANGE_FAILED");
            errorUrl.searchParams.set("message", encodeURIComponent(data.error?.message || "微信授权兑换失败"));
            return consumeNonce(NextResponse.redirect(errorUrl, 302));
        }

        const result = data.data;

        // 需要绑定手机号：将 exchange token 存入 httpOnly 临时 Cookie（避免 URL 泄露），重定向到绑定页
        if (result?.bindingRequired) {
            const bindUrl = new URL("/wechat-bind", siteOrigin);
            bindUrl.searchParams.set("redirect", redirect);
            const bindResponse = NextResponse.redirect(bindUrl, 302);
            bindResponse.cookies.set(WECHAT_BIND_COOKIE_NAME, exchangeToken, {
                httpOnly: true,
                secure: USER_ACCESS_COOKIE_OPTIONS.secure,
                sameSite: "lax" as const,
                path: "/",
                maxAge: 5 * 60, // 5 分钟有效
            });
            return consumeNonce(bindResponse);
        }

        if (!result?.user || !result.accessToken || !result.refreshToken) {
            const errorUrl = new URL(redirect, siteOrigin);
            errorUrl.searchParams.set("wechat_auth", "error");
            errorUrl.searchParams.set("code", "INVALID_EXCHANGE_RESPONSE");
            errorUrl.searchParams.set("message", encodeURIComponent("上游响应不完整"));
            return consumeNonce(NextResponse.redirect(errorUrl, 302));
        }

        const userPayload = result.user;

        // 会员等级回源（微信用户无 SSO userinfo 通道）：尽力而为，失败不阻断登录
        const membershipLevel = await fetchOfficialMembershipLevel(userPayload.phone);

        // 同步到本地数据库
        const existingByPhone = await prisma.user.findUnique({ where: { phoneNumber: userPayload.phone } });
        if (existingByPhone && existingByPhone.id !== userPayload.id) {
            logger.warn(`[AUDIT] Phone collision detected (wechat-callback): new user ${userPayload.id} conflicts with existing user ${existingByPhone.id}. Merging old record.`);
            await prisma.user.update({
                where: { id: existingByPhone.id },
                data: { phoneNumber: `merged_${existingByPhone.id}_${userPayload.phone}` }
            });
        }

        let localUser;
        try {
            localUser = await prisma.user.upsert({
                where: { id: userPayload.id },
                update: {
                    phoneNumber: userPayload.phone,
                    // 仅在本次拿到昵称时覆盖，避免微信未返回昵称时把已存昵称洗成手机号
                    ...(userPayload.nickname ? { name: userPayload.nickname } : {}),
                    avatarUrl: userPayload.avatar || null,
                    // 会员等级仅在有回源结果时覆盖（无结果不动本地值，避免回源失败洗掉已有等级）
                    ...(membershipLevel ? { membershipLevel } : {}),
                },
                create: {
                    id: userPayload.id,
                    phoneNumber: userPayload.phone,
                    password: null,
                    name: userPayload.nickname || "",
                    avatarUrl: userPayload.avatar || null,
                    membershipLevel: membershipLevel || null,
                    role: UserRole.USER,
                    tokenVersion: 0
                }
            });
        } catch (err) {
            // P2002：并发回调同时走 create 分支时只有一个成功，冲突方重读即可
            if ((err as { code?: string })?.code !== "P2002") throw err;
            localUser = await prisma.user.findUnique({ where: { id: userPayload.id } });
            if (!localUser) throw err;
        }

        const successUrl = new URL(redirect, siteOrigin);
        successUrl.searchParams.set("wechat_auth", "success");
        if (result.passwordGenerated) {
            successUrl.searchParams.set("password_generated", "true");
        }

        const response = NextResponse.redirect(successUrl, 302);

        // 设置官网同款 Cookie，后续代理官网接口时可透传
        response.cookies.set(USER_COOKIE_NAME, result.accessToken, USER_ACCESS_COOKIE_OPTIONS);
        response.cookies.set(USER_REFRESH_COOKIE_NAME, result.refreshToken, USER_REFRESH_COOKIE_OPTIONS);

        // 立即签发子站本地 session
        const sessionSigned = await signLocalSession(response, {
            id: localUser.id,
            email: null,
            phone: localUser.phoneNumber,
            name: localUser.name,
            role: localUser.role,
            tokenVersion: localUser.tokenVersion,
            dailyTestLimit: localUser.dailyTestLimit,
        }, { secure: !SSO_INSECURE_LOCAL_DEV });

        if (!sessionSigned) {
            const errorUrl = new URL(redirect, siteOrigin);
            errorUrl.searchParams.set("wechat_auth", "error");
            errorUrl.searchParams.set("code", "SESSION_SIGN_FAILED");
            errorUrl.searchParams.set("message", encodeURIComponent("会话创建失败"));
            return consumeNonce(NextResponse.redirect(errorUrl, 302));
        }

        // 切换到微信本地会话：清掉可能残留的 SSO Cookie，避免账号 BFF 误判为 SSO 体系
        clearSsoSessionCookies(response);
        return consumeNonce(response);

    } catch (error) {
        logger.error("[WechatCallback] 处理微信授权回调失败", { error: String(error) });
        const errorUrl = new URL(redirect, siteOrigin);
        errorUrl.searchParams.set("wechat_auth", "error");
        errorUrl.searchParams.set("code", "INTERNAL_ERROR");
        errorUrl.searchParams.set("message", encodeURIComponent("服务器内部错误"));
        return consumeNonce(NextResponse.redirect(errorUrl, 302));
    }
}
