import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ssoVerifier, getAccessToken, getIdTokenProfileClaims, fetchSsoUserinfo, upsertLocalUser, getLocalSessionDbUser, REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE, ID_TOKEN_COOKIE, refreshSsoTokensSingleFlight } from "@/lib/sso-auth";
import { SSO_INSECURE_LOCAL_DEV } from "@/lib/sso-config";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
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
            // 不再回退手机号：手机号只用于 phone 字段，昵称缺失时前端自行展示默认文案
            name: localUser?.name || "",
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

// 资料修改统一走 /api/account/profile，本端点仅保留 GET（会话查询）
