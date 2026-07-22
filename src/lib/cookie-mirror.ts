/**
 * Cookie 透传工具
 *
 * 子站代理官网认证接口时，需要把官网响应中的 Set-Cookie 原样（或按规范修正后）
 * 设置到子站域名下，供子站后续服务端调用官网接口时使用。
 *
 * 关键处理：
 * - 正确解析 Set-Cookie 中的属性（Expires/Max-Age/Path/Domain/Secure/HttpOnly/SameSite）
 * - 对 __Host- 前缀强制要求 Secure=true、Path=/、不带 Domain
 * - 对 __Secure- 前缀强制要求 Secure=true
 * - 支持 Max-Age=0 / Expires 过期等删除类 Cookie
 */

import { NextResponse } from "next/server";
import { logger } from "./logger";

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
  path?: string;
  maxAge?: number;
  expires?: Date;
  domain?: string;
}

interface ParsedCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

export function parseSetCookie(setCookie: string): ParsedCookie | null {
  const parts = setCookie.split(";");
  const first = parts[0].trim();

  const eqIdx = first.indexOf("=");
  if (eqIdx === -1) return null;

  const name = first.substring(0, eqIdx).trim();
  const value = first.substring(eqIdx + 1).trim();

  const options: CookieOptions = {};

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    const separatorIdx = part.indexOf("=");
    const key = (separatorIdx === -1 ? part : part.substring(0, separatorIdx)).trim();
    const val = separatorIdx === -1 ? "" : part.substring(separatorIdx + 1).trim();
    const keyLower = key.toLowerCase();

    switch (keyLower) {
      case "httponly":
        options.httpOnly = true;
        break;
      case "secure":
        options.secure = true;
        break;
      case "samesite": {
        const v = val.toLowerCase();
        if (v === "strict" || v === "lax" || v === "none") {
          options.sameSite = v;
        }
        break;
      }
      case "path":
        options.path = val;
        break;
      case "domain":
        options.domain = val;
        break;
      case "max-age": {
        const n = parseInt(val, 10);
        if (!Number.isNaN(n)) {
          options.maxAge = n;
        }
        break;
      }
      case "expires": {
        const d = new Date(val);
        if (!Number.isNaN(d.getTime())) {
          options.expires = d;
        }
        break;
      }
      default:
        // 忽略未知属性
        break;
    }
  }

  return { name, value, options };
}

/**
 * 将官网响应中的 Set-Cookie 透传到子站响应中
 *
 * @param officialResponse - 官网接口的 Response 对象
 * @param response - 子站待返回的 NextResponse 对象
 * @param context - 可选上下文标识，用于日志
 */
export function mirrorOfficialCookies(
  officialResponse: Response,
  response: NextResponse,
  context?: string
): void {
  const cookies = officialResponse.headers.getSetCookie();

  if (cookies.length === 0) {
    logger.warn(
      `[CookieMirror] Official API${context ? ` (${context})` : ""} did NOT return set-cookie header`
    );
    return;
  }

  for (const cookieStr of cookies) {
    const parsed = parseSetCookie(cookieStr);
    if (!parsed) {
      logger.warn(`[CookieMirror] Skipped invalid Set-Cookie: ${cookieStr.slice(0, 80)}`);
      continue;
    }

    const { name, value, options } = parsed;

    // 本地应用自己管理 CSRF token（必须与本地 JWT payload 中的 csrf 字段一致）。
    // 官网 CSRF 由 callOfficialApi 在服务端调用时通过 getOfficialCsrfToken() 临时获取，
    // 不需要也不应该覆盖浏览器端的本地 CSRF cookie，否则会导致本地 JWT 与 cookie 不一致，
    // 进而使所有需要 CSRF 校验的本地 POST API（如 /api/oss/sign、/api/advisor/face-analyze）返回 403。
    if (name === "__Host-csrf_token" || name === "csrf_token") {
      logger.warn(`[CookieMirror] Skipping official ${name} to preserve local CSRF token`);
      continue;
    }

    // __Host- 前缀强制要求：Secure=true, Path=/, 不能有 Domain
    if (name.startsWith("__Host-")) {
      if (!options.secure) {
        logger.warn(`[CookieMirror] __Host- cookie ${name} missing Secure; enforcing Secure=true`);
      }
      if (options.path && options.path !== "/") {
        logger.warn(`[CookieMirror] __Host- cookie ${name} has Path=${options.path}; enforcing Path=/`);
      }
      if (options.domain) {
        logger.warn(`[CookieMirror] __Host- cookie ${name} has Domain; removing it`);
        delete options.domain;
      }
      options.secure = true;
      options.path = "/";
    } else if (name.startsWith("__Secure-")) {
      if (!options.secure) {
        logger.warn(`[CookieMirror] __Secure- cookie ${name} missing Secure; enforcing Secure=true`);
      }
      options.secure = true;
    }

    response.cookies.set(name, value, options);
  }
}
