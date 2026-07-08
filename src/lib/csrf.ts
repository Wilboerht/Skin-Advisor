/**
 * C 端 CSRF 防护工具
 *
 * 采用 Double-Submit Cookie 模式：
 * 1. 登录/鉴权成功后，服务端把 CSRF token 写入 JWT payload 和同名非 HttpOnly cookie
 * 2. 前端读取 cookie 并通过 X-CSRF-Token header 回传
 * 3. 服务端校验 header 中的 token 与 JWT payload 中的 token 是否一致
 *
 * 攻击者无法读取 HttpOnly 的 JWT，因此无法构造正确的 X-CSRF-Token。
 */

import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, getJwtSecret } from "@/lib/auth-config";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/csrf-client";

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME };



/**
 * 生成随机 CSRF token（128 bit，hex 编码）
 */
export function generateCsrfToken(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * 从请求中验证 CSRF token。
 * 返回 true 表示验证通过；返回 false 表示缺失或不匹配。
 *
 * 注意：此函数在 Edge Runtime 中运行，仅依赖 Web Crypto。
 */
function getCookieFromHeader(headerValue: string | null, name: string): string | null {
    if (!headerValue) return null;
    const match = headerValue.match(new RegExp("(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
}

export async function verifyCsrfToken(request: NextRequest): Promise<boolean> {
    // 只校验非安全方法
    const unsafeMethods = ["POST", "PUT", "PATCH", "DELETE"];
    if (!unsafeMethods.includes(request.method)) {
        return true;
    }

    const cookieHeader = request.headers.get("cookie");
    const authCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? getCookieFromHeader(cookieHeader, AUTH_COOKIE_NAME);
    const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value ?? getCookieFromHeader(cookieHeader, CSRF_COOKIE_NAME);
    const csrfHeader = request.headers.get(CSRF_HEADER_NAME);

    if (!authCookie || !csrfCookie || !csrfHeader) {
        return false;
    }

    try {
        const { payload } = await jwtVerify(authCookie, getJwtSecret());
        const tokenFromJwt = payload.csrf;
        if (typeof tokenFromJwt !== "string") {
            return false;
        }

        // 三重校验：cookie == header == jwt payload（常量时间比较）
        return (
            timingSafeEqual(csrfCookie, csrfHeader) &&
            timingSafeEqual(tokenFromJwt, csrfHeader)
        );
    } catch {
        return false;
    }

    function timingSafeEqual(a: string, b: string): boolean {
        if (a.length !== b.length) return false;
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }
}
