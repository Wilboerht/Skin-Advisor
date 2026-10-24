import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwt } from "jose";
import { getAccessToken, getIdTokenProfileClaims, fetchSsoUserinfo, ssoVerifier, upsertLocalUser, isAccessTokenRevoked, refreshSsoTokensSingleFlight, clearSsoSessionCookies, REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE, ID_TOKEN_COOKIE, type RefreshedTokens } from "@/lib/sso-auth";
import { SSO_INSECURE_LOCAL_DEV, getPublicOrigin } from "@/lib/sso-config";
import { signLocalSession, rotateLocalSession, applyLocalSessionCookies, AUTH_REFRESH_COOKIE_NAME } from "@/lib/auth";
import {
    USER_COOKIE_NAME,
    USER_REFRESH_COOKIE_NAME,
    USER_ACCESS_COOKIE_OPTIONS,
    USER_REFRESH_COOKIE_OPTIONS,
} from "@/lib/wechat-constants";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { isDisabledUser } from "@/lib/permissions";
import { isSafeInternalPath } from "@/lib/url-utils";
import { logger } from "@/lib/logger";

/**
 * SSO 登录后的本地 Session 初始化端点
 *
 * SSO 回调成功后，浏览器持有 __Host-nihplod_sso_at Cookie 但缺少本地
 * JWT + CSRF Cookie（__Host-auth_token / __Host-csrf_token）。
 * 此端点读取 SSO token、校验用户身份、签发本地双 token session，
 * 确保后续 C 端写操作（POST/PUT/PATCH/DELETE）的 CSRF 校验能正常通过。
 *
 * 仅接受 GET。默认通过 302 重定向回 `return_to` 地址；`?json=1` 时返回
 * JSON `{ ok: boolean }`，供 fetchWithCsrf 静默重建会话后可靠判定结果。
 * SSO access token 过期时会先用 refresh token 静默轮换再签发。
 * 不接受 URL 参数直接传入 token。
 */
function getSafeReturnTo(req: NextRequest): string {
    const returnTo = req.nextUrl.searchParams.get("return_to") || "/";
    // 全站唯一实现，拒绝控制字符/反斜杠/协议相对 URL（Open Redirect）
    if (returnTo.length > 2048) return "/";
    return isSafeInternalPath(returnTo) ? returnTo : "/";
}

export async function GET(req: NextRequest) {
    const returnTo = getSafeReturnTo(req);
    // json=1：fetch 静默重建模式（fetchWithCsrf），返回 JSON 而非 302，
    // 让客户端能可靠判断重建结果（auth_token 是 httpOnly，document.cookie 读不到）
    const wantsJson = req.nextUrl.searchParams.get("json") === "1";

    // 重定向基准取站点公网 origin：standalone 部署下 req.url 是进程监听地址
    //（如 http://0.0.0.0:3002），直接用它会把浏览器重定向到不可达地址
    const siteOrigin = getPublicOrigin() || new URL(req.url).origin;

    const fail = (error: string, status = 200) => {
        if (wantsJson) {
            return NextResponse.json({ ok: false, error }, { status });
        }
        return NextResponse.redirect(new URL(`/?error=${error}&return_to=${encodeURIComponent(returnTo)}`, siteOrigin));
    };

    const ip = getClientIP(req);
    // 30/min/IP：多标签页同时恢复会话、企业/校园共享出口 IP 场景下 10/min 易误伤
    const limit = await rateLimit(`session-init-ip-${ip}`, "login", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limit.success) {
        return fail("rate_limited", 429);
    }

    try {
        let accessToken = await getAccessToken(req);
        // 已登出撤销的 access token 不能换发本地会话
        let payload = accessToken && !isAccessTokenRevoked(accessToken)
            ? await ssoVerifier.verify(accessToken)
            : null;

        // access_token（15 分钟）过期时用 refresh_token 静默轮换——
        // 没有这一步，fetchWithCsrf 的会话重建在 access token 过期后必然失败
        let rotated: RefreshedTokens | null = null;
        if (!payload?.sub) {
            const cookieStore = await cookies();
            const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
            if (refreshToken) {
                rotated = await refreshSsoTokensSingleFlight(refreshToken);
                if (rotated && !isAccessTokenRevoked(rotated.access_token)) {
                    payload = await ssoVerifier.verify(rotated.access_token);
                    accessToken = rotated.access_token;
                }
            }
        }

        if (!accessToken || !payload?.sub) {
            // 微信登录用户没有 SSO Cookie：本地 access JWT 过期后，
            // 用本地 refresh token 轮换新会话，而不是把用户踢回主站登录。
            const cookieStore = await cookies();
            const localRefreshToken = cookieStore.get(AUTH_REFRESH_COOKIE_NAME)?.value;
            if (localRefreshToken) {
                const rotated = await rotateLocalSession(localRefreshToken);
                if (rotated) {
                    const response = wantsJson
                        ? NextResponse.json({ ok: true })
                        : NextResponse.redirect(new URL(returnTo, siteOrigin));
                    // 共享设备/切换登录方式后可能残留上一账号的微信 USER_* Cookie；
                    // 能解析出 sub 且与当前本地会话用户不一致时清除，避免降级链路串号。
                    const tokenSub = (token?: string): string | null => {
                        if (!token) return null;
                        try {
                            const sub = decodeJwt(token).sub;
                            return typeof sub === "string" ? sub : null;
                        } catch {
                            return null;
                        }
                    };
                    const mismatched = [
                        cookieStore.get(USER_COOKIE_NAME)?.value,
                        cookieStore.get(USER_REFRESH_COOKIE_NAME)?.value,
                    ].some((t) => {
                        const sub = tokenSub(t);
                        return sub !== null && sub !== rotated.user.id;
                    });
                    if (mismatched) {
                        response.cookies.set(USER_COOKIE_NAME, "", { ...USER_ACCESS_COOKIE_OPTIONS, maxAge: 0 });
                        response.cookies.set(USER_REFRESH_COOKIE_NAME, "", { ...USER_REFRESH_COOKIE_OPTIONS, maxAge: 0 });
                    }
                    // 本地 refresh 生效 = 纯本地会话（微信登录）：清掉可能残留的 SSO Cookie
                    clearSsoSessionCookies(response);
                    applyLocalSessionCookies(response, rotated.issued, !SSO_INSECURE_LOCAL_DEV);
                    return response;
                }
            }

            logger.warn("[session-init] No valid SSO session and local refresh failed");
            return fail("no_session", 401);
        }

        // 展示字段取 id_token；会员等级只信服务端验证过的 userinfo（它决定测肤额度，客户端 Cookie 可篡改）
        const profileClaims = await getIdTokenProfileClaims();
        const userinfo = await fetchSsoUserinfo(accessToken);
        const dbUser = await upsertLocalUser(payload, {
            nickname: profileClaims?.nickname ?? userinfo?.nickname,
            avatar: profileClaims?.avatar ?? userinfo?.avatar,
            // 手机号只信已验证 access token 或服务端 userinfo，id_token 不验签不可用于授权
            phone: userinfo?.phone,
            membershipLevel: userinfo?.membershipLevel,
            totalSpent: userinfo?.totalSpent,
            // gender 三态透传（undefined 不动 / null 清除 / 值设定，见 sso-auth.ts SsoProfileClaims）
            gender: userinfo?.gender,
        }, {
            // 登录路径全量同步：userinfo 回源成功才标记同步时间，失败则留给 /api/auth/me 重试
            profileSyncedAt: userinfo ? new Date() : undefined,
        });
        if (!dbUser) {
            logger.error("[session-init] Failed to upsert local user", { sub: payload.sub });
            return fail("db_error", 500);
        }

        // 被禁用的用户不签发本地会话
        if (isDisabledUser(dbUser.role)) {
            logger.warn("[session-init] Disabled user attempted session init", { sub: payload.sub });
            return fail("no_session", 401);
        }

        const response = wantsJson
            ? NextResponse.json({ ok: true })
            : NextResponse.redirect(new URL(returnTo, siteOrigin));

        // 本轮发生过静默轮换：把新 SSO token 种回 httpOnly Cookie（与 /api/auth/me 的 Cookie 约定一致）
        if (rotated) {
            const cookieOpts = { httpOnly: true, secure: !SSO_INSECURE_LOCAL_DEV, sameSite: "lax" as const, path: "/" };
            response.cookies.set(ACCESS_TOKEN_COOKIE, rotated.access_token, { ...cookieOpts, maxAge: rotated.expires_in });
            response.cookies.set(REFRESH_TOKEN_COOKIE, rotated.refresh_token, { ...cookieOpts, maxAge: rotated.refresh_expires_in ?? 30 * 24 * 3600 });
            if (rotated.id_token) {
                response.cookies.set(ID_TOKEN_COOKIE, rotated.id_token, { ...cookieOpts, maxAge: rotated.expires_in });
            }
        }

        // 签发本地 JWT + CSRF session（本地 HTTP 开发关闭 Secure，与 SDK insecureLocalDev 的 Cookie 约定一致）
        const signed = await signLocalSession(response, {
            id: dbUser.id,
            email: dbUser.email,
            phone: dbUser.phoneNumber,
            name: dbUser.name,
            role: dbUser.role,
            tokenVersion: dbUser.tokenVersion,
            dailyTestLimit: dbUser.dailyTestLimit,
        }, { secure: !SSO_INSECURE_LOCAL_DEV });

        if (!signed) {
            logger.error("[session-init] signLocalSession failed", { userId: dbUser.id });
            return fail("session_sign_failed", 500);
        }

        // SSO 登录成功：清理上一登录方式（微信）遗留的官网 Cookie。
        // 否则账号 BFF 在 SSO token 失效时可能回退到上一账号的 USER_* token，造成串号。
        response.cookies.set(USER_COOKIE_NAME, "", { ...USER_ACCESS_COOKIE_OPTIONS, maxAge: 0 });
        response.cookies.set(USER_REFRESH_COOKIE_NAME, "", { ...USER_REFRESH_COOKIE_OPTIONS, maxAge: 0 });

        return response;
    } catch (err) {
        logger.error("[session-init] Unexpected error", { error: String(err) });
        return fail("session_init_failed", 500);
    }
}
