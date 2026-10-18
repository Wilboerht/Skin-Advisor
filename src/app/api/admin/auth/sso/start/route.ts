import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SSO_COOKIE_OPTIONS,
  ADMIN_SSO_RETURN_COOKIE,
  ADMIN_SSO_STATE_COOKIE,
  ADMIN_SSO_VERIFIER_COOKIE,
  createPkcePair,
  createSsoState,
  getAdminSsoConfig,
} from "@/lib/admin-sso";
import { getPublicOrigin } from "@/lib/sso-config";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | null): string {
  if (!value) return "/admin";
  if (
    value.startsWith("/admin") &&
    !value.startsWith("/admin/login") &&
    !value.startsWith("/admin/emergency-login")
  ) {
    return value;
  }
  return "/admin";
}

// GET /api/admin/auth/sso/start
// 生成 state + PKCE，302 到主站管理员授权端点。
export async function GET(request: NextRequest) {
  const origin = getPublicOrigin() || new URL(request.url).origin;
  const ip = getClientIP(request);
  const limit = await rateLimit(`admin-sso-start-${ip}`, "default", {
    maxRequests: 30,
    windowMs: 60 * 1000,
  });
  if (!limit.success) {
    return NextResponse.redirect(
      new URL("/admin/login?error=sso_rate_limited", origin)
    );
  }

  let config: ReturnType<typeof getAdminSsoConfig>;
  try {
    config = getAdminSsoConfig();
  } catch (error) {
    logger.error("[AdminSSO] 配置缺失", { error: String(error) });
    return NextResponse.redirect(
      new URL("/admin/login?error=sso_not_configured", origin)
    );
  }

  if (!config.enabled) {
    return NextResponse.redirect(
      new URL("/admin/login?error=sso_disabled", origin)
    );
  }

  const state = createSsoState();
  const { verifier, challenge } = createPkcePair();
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("return_to"));

  const authorizeUrl = new URL(config.authorizeUrl);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorizeUrl, {
    headers: { "Cache-Control": "no-store" },
  });
  response.cookies.set(ADMIN_SSO_STATE_COOKIE, state, ADMIN_SSO_COOKIE_OPTIONS);
  response.cookies.set(
    ADMIN_SSO_VERIFIER_COOKIE,
    verifier,
    ADMIN_SSO_COOKIE_OPTIONS
  );
  response.cookies.set(
    ADMIN_SSO_RETURN_COOKIE,
    returnTo,
    ADMIN_SSO_COOKIE_OPTIONS
  );

  return response;
}
