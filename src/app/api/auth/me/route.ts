import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ssoVerifier, getAccessToken, getIdTokenProfileClaims, normalizeSsoAvatarUrl, upsertLocalUser, SSO_BASE_URL, REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE, ID_TOKEN_COOKIE, refreshSsoTokens } from "@/lib/sso-auth";
import { SSO_INSECURE_LOCAL_DEV } from "@/lib/sso-config";
import prisma from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { verifyCsrfToken } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { UserRole, isDisabledUser } from "@/lib/permissions";

export async function GET(req: NextRequest) {
    const ip = getClientIP(req);
    const limit = await rateLimit(`me-get-ip-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limit.success) {
        return apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
    }

    const token = await getAccessToken(req);
    let payload = token ? await ssoVerifier.verify(token) : null;

    // access_token（15 分钟）过期后，用 refresh_token 静默轮换，避免页面停留期间掉登录态
    let refreshed: Awaited<ReturnType<typeof refreshSsoTokens>> = null;
    if (!payload?.sub) {
        const cookieStore = await cookies();
        const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
        if (refreshToken) {
            refreshed = await refreshSsoTokens(refreshToken);
            if (refreshed) {
                payload = await ssoVerifier.verify(refreshed.access_token);
            }
        }
    }

    if (!payload?.sub) {
        return NextResponse.json({ user: null });
    }

    // 顺带从 id_token 同步 nickname/avatar 到本地（introspect 的 access token 不含这些 claims）
    const profileClaims = await getIdTokenProfileClaims();
    const localUser = await upsertLocalUser(payload, profileClaims ?? undefined);

    // 被禁用的用户视为未登录，前端会引导其退出
    if (localUser && isDisabledUser(localUser.role)) {
        return NextResponse.json({ user: null });
    }

    const response = NextResponse.json({
        user: {
            id: payload.sub,
            phone: payload.phone || null,
            name: localUser?.name || payload.phone || "",
            avatar: localUser?.avatarUrl || null,
            role: localUser?.role || "user",
        },
    });

    // 轮换成功：把新 token 种回 httpOnly Cookie（与 SSO 回调的 Cookie 约定一致）
    if (refreshed) {
        // 本地 HTTP 开发模式下关闭 Secure（与 SDK insecureLocalDev 的 Cookie 约定一致）
        const cookieOpts = { httpOnly: true, secure: !SSO_INSECURE_LOCAL_DEV, sameSite: "lax" as const, path: "/" };
        response.cookies.set(ACCESS_TOKEN_COOKIE, refreshed.access_token, {
            ...cookieOpts,
            maxAge: refreshed.expires_in,
        });
        response.cookies.set(REFRESH_TOKEN_COOKIE, refreshed.refresh_token, {
            ...cookieOpts,
            maxAge: refreshed.refresh_expires_in ?? 30 * 24 * 3600,
        });
        if (refreshed.id_token) {
            response.cookies.set(ID_TOKEN_COOKIE, refreshed.id_token, {
                ...cookieOpts,
                maxAge: refreshed.expires_in,
            });
        }
    }

    return response;
}

export async function PUT(req: NextRequest) {
    const ip = getClientIP(req);
    const limit = await rateLimit(`me-put-ip-${ip}`, "default", { maxRequests: 10, windowMs: 60 * 1000 });
    if (!limit.success) {
        return apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
    }

    // CSRF protection for the sub-project's own endpoint
    const csrfResult = await verifyCsrfToken(req);
    if (!csrfResult.valid) {
        return apiError(ErrorCode.FORBIDDEN, "会话校验未通过，请刷新页面后再试。", 403);
    }

    const token = await getAccessToken(req);
    if (!token) {
        return apiError(ErrorCode.UNAUTHORIZED, "请先登录", 401);
    }

    const payload = await ssoVerifier.verify(token);
    if (!payload?.sub) {
        return apiError(ErrorCode.UNAUTHORIZED, "登录已过期，请重新登录", 401);
    }

    // 被禁用的用户不允许修改资料
    const existingUser = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { role: true },
    });
    if (existingUser && isDisabledUser(existingUser.role)) {
        return apiError(ErrorCode.FORBIDDEN, "该账号已被禁用", 403);
    }

    try {
        const body = await req.json();
        const officialBody: { nickname?: string; avatar?: string } = {};
        if (body.nickname !== undefined) {
            officialBody.nickname = body.nickname;
        } else if (body.name !== undefined) {
            officialBody.nickname = body.name;
        }
        if (body.avatar !== undefined) {
            officialBody.avatar = body.avatar;
        }

        const response = await fetch(`${SSO_BASE_URL}/api/user/profile`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(officialBody),
        });

        if (response.status === 401 || response.status === 403) {
            return apiError(ErrorCode.UNAUTHORIZED, "登录已过期，请重新登录", 401);
        }

        const data = (await response.json()) as { success?: boolean; data?: { user?: { id: string; phone: string; nickname: string | null; avatar: string | null } }; error?: { message?: string } };
        if (!response.ok || !data.success || !data.data?.user) {
            return apiError(
                ErrorCode.UPSTREAM_ERROR,
                data.error?.message || "更新失败",
                response.status || 502
            );
        }

        const user = data.data.user;
        const avatarUrl = normalizeSsoAvatarUrl(user.avatar) ?? null;

        // Sync the updated profile back to the local DB
        await prisma.user.upsert({
            where: { id: user.id },
            update: {
                phoneNumber: user.phone,
                name: user.nickname || user.phone,
                avatarUrl,
            },
            create: {
                id: user.id,
                phoneNumber: user.phone,
                password: null,
                name: user.nickname || user.phone,
                avatarUrl,
                role: UserRole.USER,
                tokenVersion: 0,
            },
        });

        return apiSuccess({
            user: {
                id: user.id,
                phone: user.phone,
                name: user.nickname || user.phone,
                avatar: avatarUrl,
                role: "user",
            },
        });
    } catch (err) {
        logger.error("[auth/me] PUT error:", err);
        return apiError(ErrorCode.INTERNAL_ERROR, "服务暂时不可用，请稍后再试。", 500);
    }
}
