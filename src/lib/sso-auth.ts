/**
 * SSO 认证工具
 *
 * 供子项目业务 API 路由验证 NIHPLOD 主站签发的 access_token。
 * 同时支持 Authorization: Bearer <token> 和 __Host-nihplod_sso_at Cookie。
 */

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createTokenVerifier, type VerifiedTokenPayload } from "@nihplod/sso-verify";
import { toInsecureCookieName } from "@nihplod/sso-sdk/next";
import { SSO_INSECURE_LOCAL_DEV } from "@/lib/sso-config";
import { UserRole, isDisabledUser } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_BASE_URL || "https://nihplod.cn";
export { SSO_BASE_URL };
const SSO_CLIENT_ID = process.env.NEXT_PUBLIC_SSO_CLIENT_ID!;
// Confidential Client 密钥：仅服务端使用（introspect / refresh），切勿暴露到浏览器
const SSO_CLIENT_SECRET = process.env.SSO_CLIENT_SECRET;
/**
 * insecureLocalDev（本地 HTTP 开发）下 SDK 写入的 Cookie 名会去除
 * __Host-/__Secure- 前缀（浏览器拒绝在 HTTP 下写入带前缀的 Cookie），
 * 此处读取侧必须与 SDK 保持一致。
 */
const ssoCookieName = (name: string): string =>
    SSO_INSECURE_LOCAL_DEV ? toInsecureCookieName(name) : name;

export const ACCESS_TOKEN_COOKIE = ssoCookieName("__Host-nihplod_sso_at");
export const REFRESH_TOKEN_COOKIE = ssoCookieName("__Host-nihplod_sso_rt");
export const ID_TOKEN_COOKIE = ssoCookieName("__Host-nihplod_sso_id");

/**
 * 主站用户资料 claims。
 * 展示字段（nickname/avatar/phone）可来自 id_token Cookie；
 * membershipLevel 只接受服务端验证过的 userinfo 响应——它决定测肤额度，
 * 客户端可篡改自己的 Cookie，绝不从 id_token Cookie 读取该字段。
 */
export interface SsoProfileClaims {
    nickname?: string;
    avatar?: string;
    phone?: string;
    membershipLevel?: string;
    /** 主站累计消费金额（元，membership scope 的 total_spent claim） */
    totalSpent?: number;
}

/**
 * 读取并解码 id_token Cookie 的 payload（不验签）。
 * id_token 由 SSO 回调的 SDK 验签后写入 httpOnly Cookie，此处只取
 * nickname/avatar 等展示字段；即便 Cookie 被篡改，最坏结果只是本人
 * 看到自己设置的昵称/头像，不影响身份与权限（sub 来自 access token）。
 */
export async function getIdTokenProfileClaims(): Promise<SsoProfileClaims | null> {
    const cookieStore = await cookies();
    const idToken = cookieStore.get(ID_TOKEN_COOKIE)?.value;
    if (!idToken) return null;
    try {
        const parts = idToken.split(".");
        if (parts.length !== 3) return null;
        const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
        const payload = JSON.parse(json) as Record<string, unknown>;
        return {
            nickname: typeof payload.nickname === "string" ? payload.nickname : undefined,
            avatar: typeof payload.avatar === "string" ? payload.avatar : undefined,
            phone: typeof payload.phone === "string" ? payload.phone : undefined,
        };
    } catch {
        return null;
    }
}

/** 主站头像可能是站内相对路径（/uploads/...），统一补全为主站绝对地址 */
export function normalizeSsoAvatarUrl(avatar?: string | null): string | undefined {
    if (!avatar) return undefined;
    if (avatar.startsWith("/")) return `${SSO_BASE_URL}${avatar}`;
    return avatar;
}

/**
 * 调用主站 OIDC userinfo 端点（Bearer access token），获取昵称/头像/手机号/会员等级。
 * id_token 不一定携带全部 claims，本地资料缺失时以此兜底。
 * membershipLevel 的唯一可信来源（服务端到服务端，凭证为真实的 access token）。
 * 注意：主站返回的 phone 可能是掩码格式（138****1234），调用方不得直接落库。
 */
export async function fetchSsoUserinfo(accessToken: string): Promise<SsoProfileClaims | null> {
    try {
        const res = await fetch(`${SSO_BASE_URL}/api/oauth/userinfo`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as Record<string, unknown>;
        return {
            nickname: typeof data.nickname === "string" ? data.nickname : undefined,
            avatar: typeof data.avatar === "string" ? data.avatar : undefined,
            phone: typeof data.phone === "string" ? data.phone : undefined,
            membershipLevel: typeof data.membership_level === "string" ? data.membership_level : undefined,
            totalSpent: typeof data.total_spent === "number" && Number.isFinite(data.total_spent) ? data.total_spent : undefined,
        };
    } catch {
        return null;
    }
}

export const ssoVerifier = createTokenVerifier({
    introspectionEndpoint: `${SSO_BASE_URL}/api/oauth/introspect`,
    clientId: SSO_CLIENT_ID,
    clientSecret: SSO_CLIENT_SECRET,
    audience: SSO_CLIENT_ID,
    issuer: SSO_BASE_URL,
});

/** refresh_token 轮换后主站返回的 token 集 */
export interface RefreshedTokens {
    access_token: string;
    refresh_token: string;
    id_token?: string;
    expires_in: number;
    /** 主站返回的 refresh_token 剩余有效期（秒），缺省 30 天 */
    refresh_expires_in?: number;
}

/**
 * 单飞缓存：同一 refresh token 的并发轮换共享同一个 Promise。
 * 主站 refresh_token 是一次性原子轮换——并发请求各自独立轮换会互相踩踏
 * （只有一个能成功，其余拿到 user:null 被误判为"未登录"）。
 * 轮换完成后结果保留 30 秒：紧随其后的请求仍带着旧 Cookie 到达时，
 * 直接复用已轮换的新 token，而不是拿已作废的旧 refresh token 再换一次。
 */
const inflightRefresh = new Map<string, Promise<RefreshedTokens | null>>();
const REFRESH_RESULT_TTL_MS = 30 * 1000;

export function refreshSsoTokensSingleFlight(refreshToken: string): Promise<RefreshedTokens | null> {
    const existing = inflightRefresh.get(refreshToken);
    if (existing) return existing;

    const promise = refreshSsoTokens(refreshToken);
    inflightRefresh.set(refreshToken, promise);
    promise.finally(() => {
        setTimeout(() => {
            if (inflightRefresh.get(refreshToken) === promise) {
                inflightRefresh.delete(refreshToken);
            }
        }, REFRESH_RESULT_TTL_MS);
    });
    return promise;
}

/**
 * 登出时撤销在途轮换：等待该 refresh token 尚未完成的单飞轮换，
 * 返回轮换出的新 token（若有），供登出路由一并撤销。
 * 无在途轮换时立即返回 null。
 */
export function awaitInflightRotation(refreshToken: string): Promise<RefreshedTokens | null> {
    const existing = inflightRefresh.get(refreshToken);
    if (!existing) return Promise.resolve(null);
    return existing.catch(() => null);
}

/**
 * 登出后毒化该 refresh token 的单飞缓存：30 秒内任何携带该旧 token
 * 到达的静默轮换请求直接得到 null（视为已登出），阻止在途
 * /api/auth/me（session-init）轮换响应把新 token 种回浏览器。
 */
export function poisonRefreshCache(refreshToken: string): void {
    if (inflightRefresh.has(refreshToken)) return;
    const poisoned = Promise.resolve(null);
    inflightRefresh.set(refreshToken, poisoned);
    setTimeout(() => {
        if (inflightRefresh.get(refreshToken) === poisoned) {
            inflightRefresh.delete(refreshToken);
        }
    }, REFRESH_RESULT_TTL_MS);
}

/**
 * 撤销指定 token（尽力而为，失败不抛错）。
 * 登出时用于撤销「轮换后的新 token」与当前 access token，
 * 掐掉 access token 剩余有效期造成的短暂复活窗口。
 */
export async function revokeSsoToken(
    token: string,
    tokenTypeHint: "refresh_token" | "access_token"
): Promise<void> {
    if (!SSO_CLIENT_SECRET) return;
    try {
        await fetch(`${SSO_BASE_URL}/api/oauth/revoke`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                token,
                token_type_hint: tokenTypeHint,
                client_id: SSO_CLIENT_ID,
                client_secret: SSO_CLIENT_SECRET,
            }),
        });
    } catch {
        // 撤销失败不阻断登出流程；SDK 已撤销请求 Cookie 中的旧 refresh token
    }
}

/**
 * access_token 过期/失效时的自愈：读 refresh_token Cookie 轮换新 token，
 * 并尽力把新 token 种回 httpOnly Cookie（Route Handler 可写；
 * Server Component 上下文 Cookie 只读，静默跳过，由下一次可写请求持久化）。
 */
export async function refreshSessionFromCookie(): Promise<VerifiedTokenPayload | null> {
    try {
        const cookieStore = await cookies();
        const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
        if (!refreshToken) return null;

        const rotated = await refreshSsoTokensSingleFlight(refreshToken);
        if (!rotated) return null;

        const payload = await ssoVerifier.verify(rotated.access_token);
        if (!payload?.sub) return null;

        try {
            const cookieOpts = { httpOnly: true, secure: !SSO_INSECURE_LOCAL_DEV, sameSite: "lax" as const, path: "/" };
            cookieStore.set(ACCESS_TOKEN_COOKIE, rotated.access_token, { ...cookieOpts, maxAge: rotated.expires_in });
            cookieStore.set(REFRESH_TOKEN_COOKIE, rotated.refresh_token, { ...cookieOpts, maxAge: rotated.refresh_expires_in ?? 30 * 24 * 3600 });
            if (rotated.id_token) {
                cookieStore.set(ID_TOKEN_COOKIE, rotated.id_token, { ...cookieOpts, maxAge: rotated.expires_in });
            }
        } catch {
            // Server Component 等只读上下文：本轮验证已通过，Cookie 持久化留给后续可写请求
        }
        return payload;
    } catch {
        return null;
    }
}

/**
 * 用 refresh_token 向主站换取新 token（原子轮换）。
 * 仅服务端调用；Confidential Client 必须携带 client_secret。
 * 失败（refresh_token 过期/被撤销/网络异常）返回 null，调用方按未登录处理。
 */
export async function refreshSsoTokens(refreshToken: string): Promise<RefreshedTokens | null> {
    if (!SSO_CLIENT_SECRET) return null;
    try {
        const res = await fetch(`${SSO_BASE_URL}/api/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: SSO_CLIENT_ID,
                client_secret: SSO_CLIENT_SECRET,
            }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as RefreshedTokens;
        if (!data.access_token || !data.refresh_token) return null;
        return data;
    } catch {
        return null;
    }
}

export interface SsoAuthUser {
    id: string;
    phone?: string;
}

export async function getAccessToken(req?: NextRequest): Promise<string | null> {
    const authHeader = req?.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.slice(7);
    }

    const cookieStore = await cookies();
    return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value || null;
}

export async function verifySsoToken(req?: NextRequest): Promise<VerifiedTokenPayload | null> {
    const token = await getAccessToken(req);
    if (!token) return null;
    return ssoVerifier.verify(token);
}

export async function getSsoUser(req?: NextRequest): Promise<SsoAuthUser | null> {
    const payload = await verifySsoToken(req);
    if (!payload?.sub) return null;
    return {
        id: payload.sub,
        phone: payload.phone,
    };
}

export async function upsertLocalUser(
    payload: VerifiedTokenPayload,
    profile?: SsoProfileClaims,
    options?: { profileSyncedAt?: Date }
) {
    if (!payload.sub) return null;

    // 昵称优先取 id_token 的 nickname，其次手机号；access token introspect 不含 nickname
    const name = profile?.nickname || payload.phone || undefined;
    // userinfo 返回的 phone 可能是掩码格式，掩码值不落库（避免污染真实手机号）
    const claimsPhone = profile?.phone && !profile.phone.includes("*") ? profile.phone : undefined;
    const phone = payload.phone || claimsPhone || undefined;
    const avatarUrl = normalizeSsoAvatarUrl(profile?.avatar);
    // membershipLevel 仅来自服务端验证过的 userinfo（见 SsoProfileClaims 注释）
    const membershipLevel = profile?.membershipLevel || undefined;
    // totalSpent 同理：仅接受 number，负值/小数兜底收敛，有值才覆盖本地
    const totalSpent =
        typeof profile?.totalSpent === "number" && Number.isFinite(profile.totalSpent)
            ? Math.max(0, Math.floor(profile.totalSpent))
            : undefined;

    const dbUser = await prisma.user.upsert({
        where: { id: payload.sub },
        update: {
            phoneNumber: phone,
            name,
            ...(avatarUrl ? { avatarUrl } : {}),
            ...(membershipLevel ? { membershipLevel } : {}),
            ...(totalSpent !== undefined ? { totalSpent } : {}),
            // userinfo 回源成功时由调用方传入当前时间，标记资料已同步（/api/auth/me 据此做 6 小时强制刷新）
            ...(options?.profileSyncedAt ? { profileSyncedAt: options.profileSyncedAt } : {}),
        },
        create: {
            id: payload.sub,
            phoneNumber: phone || null,
            name: name || "",
            avatarUrl: avatarUrl || null,
            membershipLevel: membershipLevel || null,
            totalSpent: totalSpent ?? 0,
            profileSyncedAt: options?.profileSyncedAt ?? null,
            password: null,
            role: UserRole.USER,
            tokenVersion: 0,
        },
        select: {
            id: true,
            email: true,
            phoneNumber: true,
            name: true,
            avatarUrl: true,
            membershipLevel: true,
            totalSpent: true,
            profileSyncedAt: true,
            role: true,
            dailyTestLimit: true,
            tokenVersion: true,
        },
    });

    return dbUser;
}

/**
 * 兼容旧 getSession() 的 SSO 版实现。
 * 通过 access_token 验证主站身份后，返回本地 User 表的完整会话信息。
 * 若本地不存在该用户则自动创建（保留肤质测试等业务关联）。
 */
export async function getSessionUser(req?: NextRequest): Promise<SessionUser | null> {
    let payload = await verifySsoToken(req);
    // access_token（15 分钟）过期后用 refresh_token 静默轮换，
    // 避免用户在测肤等长流程中被误判为未登录（401 requireLogin）
    if (!payload?.sub) {
        payload = await refreshSessionFromCookie();
    }
    if (!payload?.sub) return null;

    const dbUser = await upsertLocalUser(payload);
    if (!dbUser) return null;

    // 被管理员禁用的用户不允许继续访问任何功能
    if (isDisabledUser(dbUser.role)) return null;

    return {
        id: dbUser.id,
        email: dbUser.email,
        phone: dbUser.phoneNumber || undefined,
        name: dbUser.name || undefined,
        role: dbUser.role,
        tokenVersion: dbUser.tokenVersion,
        dailyTestLimit: dbUser.dailyTestLimit,
        membershipLevel: dbUser.membershipLevel,
        totalSpent: dbUser.totalSpent,
    };
}

export function isSsoConfigured(): boolean {
    return Boolean(SSO_CLIENT_ID && SSO_BASE_URL);
}
