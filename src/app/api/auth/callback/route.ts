import { NextRequest, NextResponse } from "next/server";
import { createCallbackRouteHandler } from "@nihplod/sso-sdk/next";

const ssoCallback = createCallbackRouteHandler({
  clientId: process.env.NEXT_PUBLIC_SSO_CLIENT_ID!,
  ssoBaseUrl: process.env.NEXT_PUBLIC_SSO_BASE_URL!,
  redirectUri: process.env.NEXT_PUBLIC_SSO_REDIRECT_URI!,
  // Skin-Advisor is a Public Client (SPA / Next.js browser flow). No clientSecret.
});

/**
 * SSO OAuth 回调处理器（带本地 Session 引导）。
 *
 * 标准 SSO 回调仅设置 __Host-nihplod_sso_at Cookie（SSO token）。
 * 本地 CSRF 校验依赖本地 JWT Cookie（__Host-auth_token）和 CSRF Cookie（__Host-csrf_token）。
 * 回调成功后引导浏览器先走 /api/auth/session-init，由该端点签发本地 JWT + CSRF session，
 * 然后再跳转到最终目标页面。
 */
export async function GET(req: NextRequest) {
  const response = await ssoCallback(req);

  const location = response.headers.get("location");
  if (location && !location.includes("error=")) {
    // 将最终跳转目标作为 return_to 参数，先经过 session-init 引导签发本地 session
    const sessionInitUrl = new URL("/api/auth/session-init", req.url);
    sessionInitUrl.searchParams.set("return_to", location);

    const newResponse = NextResponse.redirect(sessionInitUrl);
    // 复制原始响应的 Set-Cookie 头（SSO token cookies），确保浏览器收到
    const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
    for (const h of setCookieHeaders) {
      newResponse.headers.append("Set-Cookie", h);
    }
    return newResponse;
  }

  // 登录失败/取消等场景，直接透传 SDK 响应
  return response;
}
