/**
 * 账号 BFF 共用工具
 *
 * 供 src/app/api/account/* 路由使用：子站作为 BFF 代理官网
 * （nihplod.cn）的账号数据接口，统一处理 Bearer token 解析与展示掩码。
 */
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { decodeJwt } from "jose";
import { getAccessToken, refreshSessionFromCookie, ssoVerifier, hasSsoSessionCookies } from "@/lib/sso-auth";
import { SSO_SERVER_BASE_URL } from "@/lib/sso-config";
import { callOfficialApi } from "@/lib/official-api";
import { getClientIP } from "@/lib/ratelimit";

/** 官网服务器间调用的 base URL（配置内网地址时直连内网） */
export const OFFICIAL_BASE_URL = SSO_SERVER_BASE_URL;

/** 手机号展示掩码：138****1234（与 AccountModal 展示口径一致） */
export function maskPhone(phone?: string | null): string | null {
    if (!phone) return null;
    if (phone.length <= 7) return phone;
    return phone.slice(0, 3) + "****" + phone.slice(-4);
}

/** 从 Set-Cookie 头中提取指定 Cookie 的值（主站 refresh 路由只通过 Cookie 下发新 token） */
function getSetCookieValue(setCookies: string[], name: string): string | null {
    for (const raw of setCookies) {
        const pair = raw.split(";")[0]?.trim();
        if (!pair) continue;
        const eq = pair.indexOf("=");
        if (eq <= 0) continue;
        if (pair.slice(0, eq) === name) return pair.slice(eq + 1);
    }
    return null;
}

/** 不验签只解码 exp：官网 user_token 是 JWT，提前 60s 视为过期以便主动轮换 */
function isTokenExpiringSoon(token: string, skewMs = 60_000): boolean {
    try {
        const payload = decodeJwt(token);
        if (typeof payload.exp !== "number") return false;
        return payload.exp * 1000 <= Date.now() + skewMs;
    } catch {
        // 无法解码（不透明 token）时按可用处理，由官网端点最终判定
        return false;
    }
}

// 同一 refresh token 的并发刷新单飞：主站 refresh 是原子轮换，
// 并发请求会让后到者拿到 concurrent_rotation / 失效结果。
const officialUserRefreshInflight = new Map<string, Promise<string | null>>();

/**
 * 用官网 refresh Cookie 换新的 user_token。
 * 微信登录用户没有 SSO Cookie，账户 BFF 必须走这条链路，否则 access token 过期后全部 401。
 */
async function refreshOfficialUserToken(
    refreshToken: string,
    req?: NextRequest
): Promise<string | null> {
    const existing = officialUserRefreshInflight.get(refreshToken);
    if (existing) return existing;

    const task = (async () => {
        try {
            // 动态导入：wechat-constants 依赖 @nihplod/sso-sdk/next，
            // 避免账户路由单测在 Node 环境加载 Edge SDK 导致模块解析失败。
            const {
                USER_COOKIE_NAME,
                USER_REFRESH_COOKIE_NAME,
                USER_ACCESS_COOKIE_OPTIONS,
                USER_REFRESH_COOKIE_OPTIONS,
            } = await import("@/lib/wechat-constants");

            const result = await callOfficialApi({
                method: "POST",
                path: "/api/auth/refresh",
                cookies: `${USER_REFRESH_COOKIE_NAME}=${refreshToken}`,
                requireSignature: false,
                timeoutMs: 8000,
                // 主站按 IP 限流；转发真实客户端 IP，避免所有子站用户共享服务器出口桶
                clientIp: req ? getClientIP(req) : undefined,
            });
            if (!result?.ok) return null;

            const setCookies = result.officialResponse.headers.getSetCookie?.() ?? [];
            const accessToken = getSetCookieValue(setCookies, USER_COOKIE_NAME);
            if (!accessToken) return null;
            const newRefreshToken = getSetCookieValue(setCookies, USER_REFRESH_COOKIE_NAME);

            // Route Handler 的 cookies() 可写：直接更新浏览器 Cookie，
            // 后续请求无需再次刷新。
            const cookieStore = await cookies();
            cookieStore.set(USER_COOKIE_NAME, accessToken, USER_ACCESS_COOKIE_OPTIONS);
            if (newRefreshToken) {
                cookieStore.set(USER_REFRESH_COOKIE_NAME, newRefreshToken, USER_REFRESH_COOKIE_OPTIONS);
            }
            return accessToken;
        } catch {
            return null;
        }
    })();

    officialUserRefreshInflight.set(refreshToken, task);
    try {
        return await task;
    } finally {
        officialUserRefreshInflight.delete(refreshToken);
    }
}

/**
 * 判断官网 USER token 是否属于当前用户。
 * 能解析出 sub 时必须一致；不透明 token / 解析失败时交给官网端点最终鉴权。
 */
function userTokenMatchesUser(token: string, expectedUserId: string): boolean {
    try {
        const payload = decodeJwt(token);
        return typeof payload.sub !== "string" || payload.sub === expectedUserId;
    } catch {
        return true;
    }
}

/**
 * 取一个可转发给官网的 access token：
 * 1. 有效 SSO access token；
 * 2. SSO refresh 轮换后的 access token；
 * 3. 微信登录的官网 user_token（仅当浏览器没有 SSO 会话 Cookie 时才允许）。
 *
 * @param expectedUserId 当前本地会话用户 id。微信 USER_* Cookie 的 sub 必须与之一致，
 *   防止共享设备/切换登录方式后串用上一账号的官网凭证。
 *
 * 调用前应先通过 getSessionUser 鉴权；此处返回 null 视为会话失效（401）。
 */
export async function resolveOfficialAccessToken(
    req?: NextRequest,
    expectedUserId?: string
): Promise<string | null> {
    const authHeader = req?.headers.get("authorization") || "";
    const token = await getAccessToken(req);
    if (token) {
        const payload = await ssoVerifier.verify(token);
        if (payload?.sub) return token;

        // Bearer 通道（小程序/服务端）：验证失败直接拒绝，禁止回退浏览器 Cookie，
        // 否则调用方可能借用同浏览器中另一账号的官网登录态。
        if (authHeader.startsWith("Bearer ")) return null;
    }

    const rotated = await refreshSessionFromCookie();
    if (rotated?.sub) {
        // 轮换已把新 token 种回 Cookie（Route Handler 可写上下文），不带 req 重读 Cookie
        const newToken = await getAccessToken();
        if (newToken) return newToken;
    }

    // 浏览器仍在 SSO 登录体系内（access 过期 / refresh 失效）：不能回退到微信 USER_* Cookie。
    // 这是跨账号串用的关键防线：SSO 用户 A 的浏览器里可能残留上一微信账号 B 的 USER_* Cookie。
    if (await hasSsoSessionCookies(req)) {
        return null;
    }

    // 微信登录用户：没有 SSO 会话 Cookie，只有官网 USER_* Cookie
    const { USER_COOKIE_NAME, USER_REFRESH_COOKIE_NAME } = await import("@/lib/wechat-constants");
    const cookieStore = await cookies();
    const userToken = req?.cookies?.get(USER_COOKIE_NAME)?.value ?? cookieStore.get(USER_COOKIE_NAME)?.value;
    const userRefreshToken = req?.cookies?.get(USER_REFRESH_COOKIE_NAME)?.value
        ?? cookieStore.get(USER_REFRESH_COOKIE_NAME)?.value;

    if (userToken && !isTokenExpiringSoon(userToken)) {
        if (expectedUserId && !userTokenMatchesUser(userToken, expectedUserId)) return null;
        return userToken;
    }

    if (userRefreshToken) {
        const refreshed = await refreshOfficialUserToken(userRefreshToken, req);
        if (!refreshed) return null;
        if (expectedUserId && !userTokenMatchesUser(refreshed, expectedUserId)) return null;
        return refreshed;
    }

    return null;
}
