import { NextRequest, NextResponse } from "next/server";
import { createLogoutRouteHandler } from "@nihplod/sso-sdk/next";
import { clearLocalSession } from "@/lib/auth";
import { SSO_INSECURE_LOCAL_DEV } from "@/lib/sso-config";
import {
    awaitInflightRotation,
    poisonRefreshCache,
    revokeSsoToken,
    REFRESH_TOKEN_COOKIE,
    ACCESS_TOKEN_COOKIE,
} from "@/lib/sso-auth";

const handler = createLogoutRouteHandler({
  clientId: process.env.NEXT_PUBLIC_SSO_CLIENT_ID!,
  // Confidential Client：撤销 refresh_token 必须携带客户端密钥（服务端变量，不进浏览器包）
  clientSecret: process.env.SSO_CLIENT_SECRET,
  ssoBaseUrl: process.env.NEXT_PUBLIC_SSO_BASE_URL!,
  redirectUri: process.env.NEXT_PUBLIC_SSO_REDIRECT_URI!,
  postLogoutRedirectUri: process.env.NEXT_PUBLIC_BASE_URL || "https://advisor.nihplod.cn",
  redirectToSso: true,
  // 本地 HTTP 开发模式：必须与 middleware/callback/login 保持一致
  insecureLocalDev: SSO_INSECURE_LOCAL_DEV,
});

// 允许的登出请求源（防 CSRF 登出：恶意页面不得通过 GET 链接/图片强制用户登出）
const ALLOWED_LOGOUT_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL || "",
  process.env.NEXT_PUBLIC_BASE_URL || "",
  ...(process.env.NODE_ENV !== "production" ? ["http://localhost:3000", "http://127.0.0.1:3000"] : []),
].filter(Boolean);

function isSameOriginRequest(req: NextRequest): boolean {
  const candidates = [req.headers.get("origin"), req.headers.get("referer")];
  return candidates.some((value) => {
    if (!value) return false;
    return ALLOWED_LOGOUT_ORIGINS.some((allowed) => {
      if (value === allowed) return true;
      try {
        return new URL(value).origin === allowed;
      } catch {
        return false;
      }
    });
  });
}

/**
 * SSO 登出处理器（同步清除本地 Session Cookie）。
 *
 * SSO SDK 的 createLogoutRouteHandler 仅清除 SSO Cookie
 *（__Host-nihplod_sso_at / __Host-nihplod_sso_rt），
 * 不会触及本地 JWT + CSRF Cookie（__Host-auth_token / __Host-csrf_token）。
 *
 * 若登出后不清除本地 Cookie，CSRF 校验在 Cookie 过期前（最多 30 天）仍会通过，
 * 导致已登出用户的浏览器在共享设备上仍可发起受保护写操作。
 *
 * 因此无论 SSO 登出成功与否，始终同步清除本地 session Cookie。
 *
 * 仅保留 POST：登出是状态变更操作，GET 登出可被恶意站点通过
 * <img>/<link> 等无需用户交互的方式触发（登出型 CSRF）。
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json(
      { error: "Forbidden: cross-origin logout not allowed", code: "FORBIDDEN_ORIGIN" },
      { status: 403 }
    );
  }

  // 登出与静默轮换的竞态防护：
  // UserProvider 的定时/visibilitychange 刷新会在后台触发 /api/auth/me 的
  // refresh_token 轮换。若轮换与登出并发，轮换响应携带的新 token Set-Cookie
  // 会在登出清理之后落地，把有效会话重新种回浏览器（"退出后过一会儿又自动登录"）。
  // 因此登出前先等待在途轮换拿到新 token，随后一并撤销新 token 并毒化缓存，
  // 让 30 秒内携带旧 refresh token 到达的轮换请求直接失败。
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
  const rotated = refreshToken ? await awaitInflightRotation(refreshToken) : null;

  const response = await handler(req);
  // 不论 SSO 登出是否成功，始终清除本地 JWT + CSRF Cookie
  clearLocalSession(response);

  const revocations: Promise<void>[] = [];
  if (refreshToken) {
    poisonRefreshCache(refreshToken);
    if (rotated) {
      revocations.push(revokeSsoToken(rotated.refresh_token, "refresh_token"));
      revocations.push(revokeSsoToken(rotated.access_token, "access_token"));
    }
  }
  // 同时撤销浏览器当前持有的 access token：否则轮换响应若已把新 token
  // 种回 Cookie，未撤销的 access token 在剩余有效期内仍可通过 /api/auth/me 校验
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  if (accessToken) {
    revocations.push(revokeSsoToken(accessToken, "access_token"));
  }
  if (revocations.length > 0) {
    await Promise.allSettled(revocations);
  }

  return response;
}
