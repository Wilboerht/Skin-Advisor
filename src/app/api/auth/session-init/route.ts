import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAccessToken, getIdTokenProfileClaims, fetchSsoUserinfo, ssoVerifier, upsertLocalUser, refreshSsoTokensSingleFlight, REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE, ID_TOKEN_COOKIE, type RefreshedTokens } from "@/lib/sso-auth";
import { SSO_INSECURE_LOCAL_DEV } from "@/lib/sso-config";
import { signLocalSession } from "@/lib/auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { isDisabledUser } from "@/lib/permissions";
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
    // 仅允许相对路径，防止开放重定向（Open Redirect）
    if (returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.startsWith("/\\")) {
        return returnTo;
    }
    return "/";
}

export async function GET(req: NextRequest) {
    const returnTo = getSafeReturnTo(req);
    // json=1：fetch 静默重建模式（fetchWithCsrf），返回 JSON 而非 302，
    // 让客户端能可靠判断重建结果（auth_token 是 httpOnly，document.cookie 读不到）
    const wantsJson = req.nextUrl.searchParams.get("json") === "1";

    const fail = (error: string, status = 200) => {
        if (wantsJson) {
            return NextResponse.json({ ok: false, error }, { status });
        }
        return NextResponse.redirect(new URL(`/?error=${error}&return_to=${encodeURIComponent(returnTo)}`, req.url));
    };

    const ip = getClientIP(req);
    const limit = await rateLimit(`session-init-ip-${ip}`, "login", { maxRequests: 10, windowMs: 60 * 1000 });
    if (!limit.success) {
        return fail("rate_limited", 429);
    }

    try {
        let accessToken = await getAccessToken(req);
        let payload = accessToken ? await ssoVerifier.verify(accessToken) : null;

        // access_token（15 分钟）过期时用 refresh_token 静默轮换——
        // 没有这一步，fetchWithCsrf 的会话重建在 access token 过期后必然失败
        let rotated: RefreshedTokens | null = null;
        if (!payload?.sub) {
            const cookieStore = await cookies();
            const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
            if (refreshToken) {
                rotated = await refreshSsoTokensSingleFlight(refreshToken);
                if (rotated) {
                    payload = await ssoVerifier.verify(rotated.access_token);
                    accessToken = rotated.access_token;
                }
            }
        }

        if (!accessToken || !payload?.sub) {
            logger.warn("[session-init] No valid SSO session (access expired, refresh missing or revoked)");
            return fail("no_session", 401);
        }

        // 展示字段取 id_token；会员等级只信服务端验证过的 userinfo（它决定测肤额度，客户端 Cookie 可篡改）
        const profileClaims = await getIdTokenProfileClaims();
        const userinfo = await fetchSsoUserinfo(accessToken);
        const dbUser = await upsertLocalUser(payload, {
            nickname: profileClaims?.nickname ?? userinfo?.nickname,
            avatar: profileClaims?.avatar ?? userinfo?.avatar,
            phone: profileClaims?.phone,
            membershipLevel: userinfo?.membershipLevel,
            totalSpent: userinfo?.totalSpent,
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
            : NextResponse.redirect(new URL(returnTo, req.url));

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

        return response;
    } catch (err) {
        logger.error("[session-init] Unexpected error", { error: String(err) });
        return fail("session_init_failed", 500);
    }
}
