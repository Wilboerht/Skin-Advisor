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

/** id_token 里与展示相关的 claims（身份判定永远只用验证过的 access token，这里仅取昵称/头像） */
export interface IdTokenProfileClaims {
    nickname?: string;
    avatar?: string;
    phone?: string;
}

/**
 * 读取并解码 id_token Cookie 的 payload（不验签）。
 * id_token 由 SSO 回调的 SDK 验签后写入 httpOnly Cookie，此处只取
 * nickname/avatar 等展示字段；即便 Cookie 被篡改，最坏结果只是本人
 * 看到自己设置的昵称/头像，不影响身份与权限（sub 来自 access token）。
 */
export async function getIdTokenProfileClaims(): Promise<IdTokenProfileClaims | null> {
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

export async function upsertLocalUser(payload: VerifiedTokenPayload, profile?: IdTokenProfileClaims) {
    if (!payload.sub) return null;

    // 昵称优先取 id_token 的 nickname，其次手机号；access token introspect 不含 nickname
    const name = profile?.nickname || payload.phone || undefined;
    const avatarUrl = normalizeSsoAvatarUrl(profile?.avatar);

    const dbUser = await prisma.user.upsert({
        where: { id: payload.sub },
        update: {
            phoneNumber: payload.phone || undefined,
            name,
            ...(avatarUrl ? { avatarUrl } : {}),
        },
        create: {
            id: payload.sub,
            phoneNumber: payload.phone || null,
            name: name || "",
            avatarUrl: avatarUrl || null,
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
    const payload = await verifySsoToken(req);
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
    };
}

export function isSsoConfigured(): boolean {
    return Boolean(SSO_CLIENT_ID && SSO_BASE_URL);
}
