import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getIdTokenProfileClaims, ssoVerifier, upsertLocalUser } from "@/lib/sso-auth";
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
 * 仅接受 GET，通过 302 重定向回 `return_to` 地址。不接受 URL 参数直接传入 token。
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

    const ip = getClientIP(req);
    const limit = await rateLimit(`session-init-ip-${ip}`, "login", { maxRequests: 10, windowMs: 60 * 1000 });
    if (!limit.success) {
        return NextResponse.redirect(new URL(`/?error=rate_limited&return_to=${encodeURIComponent(returnTo)}`, req.url));
    }

    try {
        const accessToken = await getAccessToken(req);
        if (!accessToken) {
            logger.warn("[session-init] No SSO access token found");
            return NextResponse.redirect(new URL(`/?error=no_session&return_to=${encodeURIComponent(returnTo)}`, req.url));
        }

        const payload = await ssoVerifier.verify(accessToken);
        if (!payload?.sub) {
            logger.warn("[session-init] SSO token verification failed");
            return NextResponse.redirect(new URL(`/?error=invalid_token&return_to=${encodeURIComponent(returnTo)}`, req.url));
        }

        // 顺带从 id_token 取 nickname/avatar 同步到本地（introspect 的 access token 不含这些 claims）
        const profileClaims = await getIdTokenProfileClaims();
        const dbUser = await upsertLocalUser(payload, profileClaims ?? undefined);
        if (!dbUser) {
            logger.error("[session-init] Failed to upsert local user", { sub: payload.sub });
            return NextResponse.redirect(new URL(`/?error=db_error&return_to=${encodeURIComponent(returnTo)}`, req.url));
        }

        // 被禁用的用户不签发本地会话
        if (isDisabledUser(dbUser.role)) {
            logger.warn("[session-init] Disabled user attempted session init", { sub: payload.sub });
            return NextResponse.redirect(new URL(`/?error=no_session&return_to=${encodeURIComponent(returnTo)}`, req.url));
        }

        const response = NextResponse.redirect(new URL(returnTo, req.url));

        // 签发本地 JWT + CSRF session
        const signed = await signLocalSession(response, {
            id: dbUser.id,
            email: dbUser.email,
            phone: dbUser.phoneNumber,
            name: dbUser.name,
            role: dbUser.role,
            tokenVersion: dbUser.tokenVersion,
            dailyTestLimit: dbUser.dailyTestLimit,
        });

        if (!signed) {
            logger.error("[session-init] signLocalSession failed", { userId: dbUser.id });
            return NextResponse.redirect(new URL(`/?error=session_sign_failed&return_to=${encodeURIComponent(returnTo)}`, req.url));
        }

        return response;
    } catch (err) {
        logger.error("[session-init] Unexpected error", { error: String(err) });
        return NextResponse.redirect(new URL(`/?error=session_init_failed&return_to=${encodeURIComponent(returnTo)}`, req.url));
    }
}
