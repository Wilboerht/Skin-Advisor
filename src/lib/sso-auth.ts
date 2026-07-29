/**
 * SSO 认证工具
 *
 * 供子项目业务 API 路由验证 NIHPLOD 主站签发的 access_token。
 * 同时支持 Authorization: Bearer <token> 和 __Host-nihplod_sso_at Cookie。
 */

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createTokenVerifier, type VerifiedTokenPayload } from "@nihplod/sso-verify";
import prisma from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_BASE_URL || "https://nihplod.cn";
const SSO_CLIENT_ID = process.env.NEXT_PUBLIC_SSO_CLIENT_ID!;
const ACCESS_TOKEN_COOKIE = "__Host-nihplod_sso_at";

export const ssoVerifier = createTokenVerifier({
    introspectionEndpoint: `${SSO_BASE_URL}/api/oauth/introspect`,
    clientId: SSO_CLIENT_ID,
    audience: SSO_CLIENT_ID,
    issuer: SSO_BASE_URL,
});

export interface SsoAuthUser {
    id: string;
    phone?: string;
}

export async function getAccessToken(req?: NextRequest): Promise<string | null> {
    // 1. Authorization header
    const authHeader = req?.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.slice(7);
    }

    // 2. SSO access_token cookie
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

/**
 * 兼容旧 getSession() 的 SSO 版实现。
 * 通过 access_token 验证主站身份后，返回本地 User 表的完整会话信息。
 * 若本地不存在该用户则自动创建（保留肤质测试等业务关联）。
 */
export async function getSessionUser(req?: NextRequest): Promise<SessionUser | null> {
    const payload = await verifySsoToken(req);
    if (!payload?.sub) return null;

    let dbUser = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
            id: true,
            email: true,
            phoneNumber: true,
            name: true,
            role: true,
            dailyTestLimit: true,
            tokenVersion: true,
        },
    });

    if (!dbUser) {
        dbUser = await prisma.user.create({
            data: {
                id: payload.sub,
                phoneNumber: payload.phone || null,
                name: payload.phone || "",
                password: "",
                role: "user",
                tokenVersion: 0,
            },
            select: {
                id: true,
                email: true,
                phoneNumber: true,
                name: true,
                role: true,
                dailyTestLimit: true,
                tokenVersion: true,
            },
        });
    }

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
