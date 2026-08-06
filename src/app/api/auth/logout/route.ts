import { NextRequest, NextResponse } from "next/server";
import { createLogoutRouteHandler } from "@nihplod/sso-sdk/next";
import { clearLocalSession } from "@/lib/auth";

const handler = createLogoutRouteHandler({
  clientId: process.env.NEXT_PUBLIC_SSO_CLIENT_ID!,
  ssoBaseUrl: process.env.NEXT_PUBLIC_SSO_BASE_URL!,
  redirectUri: process.env.NEXT_PUBLIC_SSO_REDIRECT_URI!,
  postLogoutRedirectUri: process.env.NEXT_PUBLIC_BASE_URL || "https://advisor.nihplod.cn",
  // Public Client: no clientSecret
  redirectToSso: true,
});

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
 */
async function handleLogout(req: NextRequest): Promise<NextResponse> {
  const response = await handler(req);
  // 不论 SSO 登出是否成功，始终清除本地 JWT + CSRF Cookie
  clearLocalSession(response);
  return response;
}

export const GET = handleLogout;
export const POST = handleLogout;
