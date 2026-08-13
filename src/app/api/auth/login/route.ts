import { NextRequest, NextResponse } from "next/server";
import {
    DEFAULT_STATE_COOKIE_NAME,
    DEFAULT_RETURN_COOKIE_NAME,
    DEFAULT_VERIFIER_COOKIE_NAME,
    getHostCookieOptions,
    getSecureCookieOptions,
} from "@nihplod/sso-sdk/next";

/**
 * SSO 登录入口（BFF 模式）。
 *
 * 浏览器端 SDK（SsoClient.login）把 PKCE state/verifier 存在 sessionStorage，
 * 与服务端回调 createCallbackRouteHandler 读取 httpOnly Cookie 的模式互斥，
 * 因此登录发起也必须走服务端：本路由生成 state/verifier 写入 Cookie
 *（与 createSsoMiddleware 完全相同的约定），再 302 到主站 authorize。
 *
 * 用法：window.location.href = "/api/auth/login?return_to=/profile"
 */

const SSO_BASE_URL = (process.env.NEXT_PUBLIC_SSO_BASE_URL || "https://nihplod.cn").replace(/\/+$/, "");
const SSO_CLIENT_ID = process.env.NEXT_PUBLIC_SSO_CLIENT_ID!;
const SSO_REDIRECT_URI = process.env.NEXT_PUBLIC_SSO_REDIRECT_URI!;
const SSO_SCOPES = process.env.NEXT_PUBLIC_SSO_SCOPES || "openid profile";
const CALLBACK_PATH = "/api/auth/callback";

/** 生成 URL-safe 随机字符串（与 SDK 中间件同源实现） */
function generateRandomString(length: number): string {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes).slice(0, length);
}

function base64UrlEncode(bytes: Uint8Array): string {
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function computeCodeChallenge(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return base64UrlEncode(new Uint8Array(digest));
}

/** return_to 仅允许站内相对路径，防开放重定向 */
function sanitizeReturnTo(value: string | null): string {
    if (!value) return "/";
    if (!value.startsWith("/") || value.startsWith("//")) return "/";
    return value.slice(0, 2048);
}

export async function GET(req: NextRequest) {
    const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get("return_to"));

    const state = generateRandomString(32);
    const verifier = generateRandomString(64);
    const challenge = await computeCodeChallenge(verifier);

    const authorizeParams = new URLSearchParams({
        response_type: "code",
        client_id: SSO_CLIENT_ID,
        redirect_uri: SSO_REDIRECT_URI,
        scope: SSO_SCOPES,
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
    });

    const response = NextResponse.redirect(`${SSO_BASE_URL}/api/oauth/authorize?${authorizeParams.toString()}`);
    response.cookies.set(DEFAULT_STATE_COOKIE_NAME, state, getHostCookieOptions(600));
    response.cookies.set(DEFAULT_VERIFIER_COOKIE_NAME, verifier, getSecureCookieOptions(600, CALLBACK_PATH));
    response.cookies.set(DEFAULT_RETURN_COOKIE_NAME, returnTo, getHostCookieOptions(600));
    return response;
}
