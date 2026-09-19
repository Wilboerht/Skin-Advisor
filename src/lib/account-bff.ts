/**
 * 账号 BFF 共用工具
 *
 * 供 src/app/api/account/* 路由使用：子站作为 BFF 代理官网
 * （nihplod.cn）的账号数据接口，统一处理 Bearer token 解析与展示掩码。
 */
import type { NextRequest } from "next/server";
import { getAccessToken, refreshSessionFromCookie, ssoVerifier } from "@/lib/sso-auth";
import { SSO_SERVER_BASE_URL } from "@/lib/sso-config";

/** 官网服务器间调用的 base URL（配置内网地址时直连内网） */
export const OFFICIAL_BASE_URL = SSO_SERVER_BASE_URL;

/** 手机号展示掩码：138****1234（与 AccountModal 展示口径一致） */
export function maskPhone(phone?: string | null): string | null {
    if (!phone) return null;
    if (phone.length <= 7) return phone;
    return phone.slice(0, 3) + "****" + phone.slice(-4);
}

/**
 * 取一个可转发给官网的 access token：
 * 先用当前 token（Authorization 头或 Cookie），失效则用 refresh_token
 * 静默轮换（refreshSessionFromCookie 会把新 token 写回 Cookie），再重读 Cookie。
 *
 * 调用前应先通过 getSessionUser 鉴权；此处返回 null 视为会话失效（401）。
 */
export async function resolveOfficialAccessToken(req?: NextRequest): Promise<string | null> {
    const token = await getAccessToken(req);
    if (token) {
        const payload = await ssoVerifier.verify(token);
        if (payload?.sub) return token;
    }

    const rotated = await refreshSessionFromCookie();
    if (!rotated?.sub) return null;

    // 轮换已把新 token 种回 Cookie（Route Handler 可写上下文），不带 req 重读 Cookie 获取新 token
    return getAccessToken();
}
