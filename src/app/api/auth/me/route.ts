import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ssoVerifier, getAccessToken, getIdTokenProfileClaims, fetchSsoUserinfo, normalizeSsoAvatarUrl, upsertLocalUser, getLocalSessionDbUser, isAccessTokenRevoked, REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE, ID_TOKEN_COOKIE, refreshSsoTokensSingleFlight } from "@/lib/sso-auth";
import { SSO_INSECURE_LOCAL_DEV, SSO_SERVER_BASE_URL } from "@/lib/sso-config";
import prisma from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { verifyCsrfToken } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { isDisabledUser } from "@/lib/permissions";

export async function GET(req: NextRequest) {
    const ip = getClientIP(req);
    const limit = await rateLimit(`me-get-ip-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limit.success) {
        return apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
    }

    const token = await getAccessToken(req);
    let payload = token ? await ssoVerifier.verify(token) : null;

    // access_token（15 分钟）过期后，用 refresh_token 静默轮换，避免页面停留期间掉登录态
    // 单飞：并发 /api/auth/me 共享同一次轮换，避免一次性 refresh_token 互相踩踏
    let refreshed: Awaited<ReturnType<typeof refreshSsoTokensSingleFlight>> = null;
    if (!payload?.sub) {
        const cookieStore = await cookies();
        const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
        if (refreshToken) {
            refreshed = await refreshSsoTokensSingleFlight(refreshToken);
            if (refreshed) {
                payload = await ssoVerifier.verify(refreshed.access_token);
            }
        }
    }

    if (!payload?.sub) {
        // 微信登录兜底：主站微信 exchange 流程不在主站域种 SSO 会话 Cookie，
        // 微信用户仅持有本地 JWT（__Host-auth_token）。此处按本地会话返回用户，
        // 保证前端显示已登录；tokenVersion 比对与禁用检查在 getLocalSessionDbUser 内完成
        const localUser = await getLocalSessionDbUser();
        if (!localUser) {
            return NextResponse.json({ user: null });
        }
        return NextResponse.json({
            user: {
                id: localUser.id,
                phone: localUser.phoneNumber || null,
                name: localUser.name || "",
                avatar: localUser.avatarUrl || null,
                membershipLevel: localUser.membershipLevel || null,
                totalSpent: localUser.totalSpent ?? null,
                gender: localUser.gender ?? null,
                role: localUser.role || "user",
            },
        });
    }

    // 顺带从 id_token 同步 nickname/avatar 到本地（introspect 的 access token 不含这些 claims）
    const profileClaims = await getIdTokenProfileClaims();
    let localUser = await upsertLocalUser(payload, profileClaims ?? undefined);

    // 本地缺头像/手机号/会员等级时兜底：向主站 userinfo 拉一次并落库（仅缺失时触发，避免每次请求都回源）
    // userinfo 的 phone 是掩码格式（不落库），但弹层展示本来就要打码，可直接用于显示；
    // membershipLevel 只信 userinfo（服务端验证），不读 id_token Cookie。
    // 额外：profileSyncedAt 超过 6 小时未刷新也强制回源——老用户三项齐全后 totalSpent 不再更新，
    // 银卡消费加赠会在两次登录（session-init）之间失效。
    const PROFILE_SYNC_TTL_MS = 6 * 60 * 60 * 1000;
    let maskedPhone: string | null = null;
    const profileStale =
        !localUser?.profileSyncedAt ||
        Date.now() - localUser.profileSyncedAt.getTime() > PROFILE_SYNC_TTL_MS;
    if (localUser && (!localUser.avatarUrl || !localUser.phoneNumber || !localUser.membershipLevel || profileStale)) {
        const userinfoToken = refreshed?.access_token ?? token;
        const info = userinfoToken ? await fetchSsoUserinfo(userinfoToken) : null;
        if (info) {
            maskedPhone = info.phone ?? null;
            localUser = await upsertLocalUser(payload, {
                nickname: info.nickname ?? profileClaims?.nickname,
                avatar: info.avatar ?? profileClaims?.avatar,
                phone: info.phone ?? profileClaims?.phone,
                membershipLevel: info.membershipLevel,
                totalSpent: info.totalSpent,
                gender: info.gender,
            }, { profileSyncedAt: new Date() });
        }
    }

    // 被禁用的用户视为未登录，前端会引导其退出
    if (localUser && isDisabledUser(localUser.role)) {
        return NextResponse.json({ user: null });
    }

    const response = NextResponse.json({
        user: {
            id: payload.sub,
            phone: localUser?.phoneNumber || payload.phone || profileClaims?.phone || maskedPhone,
            name: localUser?.name || payload.phone || "",
            avatar: localUser?.avatarUrl || null,
            membershipLevel: localUser?.membershipLevel || null,
            totalSpent: localUser?.totalSpent ?? null,
            gender: localUser?.gender ?? null,
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

    // 登出撤销窗口：已撤销的 access token 在剩余有效期内不得再改资料
    if (isAccessTokenRevoked(token)) {
        return apiError(ErrorCode.UNAUTHORIZED, "登录已过期，请重新登录", 401);
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
        // 主站契约：PATCH /api/oauth/userinfo 仅接受 nickname/avatar/birthday/gender，
        // 本端点透传昵称/头像/性别（生日走 /api/account/profile）
        const officialBody: { nickname?: string; avatar?: string; gender?: "male" | "female" | null } = {};
        if (body.nickname !== undefined) {
            officialBody.nickname = body.nickname;
        } else if (body.name !== undefined) {
            officialBody.nickname = body.name;
        }
        if (body.avatar !== undefined) {
            officialBody.avatar = body.avatar;
        }
        if (body.gender !== undefined) {
            if (body.gender !== null && body.gender !== "male" && body.gender !== "female") {
                return apiError(ErrorCode.VALIDATION_ERROR, "gender 仅支持 male/female/null", 400);
            }
            officialBody.gender = body.gender;
        }

        // 主站 OIDC 资料修改端点（Bearer OAuth access token，需 profile:write scope）。
        // 主站 PUT /api/user/profile 只认主站自有会话 JWT，子站 OAuth token 必被拒，
        // 因此必须走 /api/oauth/userinfo；服务器间调用走内网地址（若配置）。
        const response = await fetch(`${SSO_SERVER_BASE_URL}/api/oauth/userinfo`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(officialBody),
        });

        // 成功返回扁平 claims {sub, nickname, avatar, gender, birthday}；
        // 失败返回 {error, error_description}
        const data = (await response.json().catch(() => null)) as {
            sub?: string;
            nickname?: string;
            avatar?: string;
            gender?: "male" | "female" | null;
            error?: string;
            error_description?: string;
        } | null;

        if (response.status === 401) {
            return apiError(ErrorCode.UNAUTHORIZED, "登录已过期，请重新登录", 401);
        }
        if (response.status === 403) {
            if (data?.error === "insufficient_scope") {
                // 多为 client 未放行 profile:write scope（主站后台 / NEXT_PUBLIC_SSO_SCOPES）
                logger.error("[auth/me] PUT 主站拒绝：insufficient_scope（请检查 client scopes 配置）");
                return apiError(ErrorCode.FORBIDDEN, "未授权资料修改", 403);
            }
            // birthday_locked / account_disabled 等：透传主站描述
            return apiError(ErrorCode.FORBIDDEN, data?.error_description || "当前账号没有修改资料的权限", 403);
        }
        if (!response.ok || !data?.sub) {
            logger.warn("[auth/me] PUT 主站响应异常", { status: response.status, error: data?.error });
            return apiError(ErrorCode.UPSTREAM_ERROR, data?.error_description || "更新失败", 502);
        }

        // 同步本地副本（gender 三态：undefined 不动 / null 清除 / 值设定，与 sso-auth 口径一致）
        const localUser = await upsertLocalUser(payload, {
            nickname: data.nickname,
            avatar: data.avatar,
            gender: data.gender,
        });

        return apiSuccess({
            user: {
                id: data.sub,
                phone: localUser?.phoneNumber || payload.phone || null,
                name: data.nickname || localUser?.name || "",
                avatar: normalizeSsoAvatarUrl(data.avatar) ?? localUser?.avatarUrl ?? null,
                gender: data.gender ?? null,
                role: localUser?.role || "user",
            },
        });
    } catch (err) {
        logger.error("[auth/me] PUT error:", err);
        return apiError(ErrorCode.INTERNAL_ERROR, "服务暂时不可用，请稍后再试。", 500);
    }
}
