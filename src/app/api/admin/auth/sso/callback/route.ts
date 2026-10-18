import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SSO_COOKIE_OPTIONS,
  ADMIN_SSO_RETURN_COOKIE,
  ADMIN_SSO_STATE_COOKIE,
  ADMIN_SSO_VERIFIER_COOKIE,
  AdminSsoError,
  createSsoAdminSession,
  exchangeAdminSsoCode,
  getAdminSsoConfig,
  resolveLocalAdminRole,
  upsertShadowAdmin,
  verifyAdminSsoAssertion,
} from "@/lib/admin-sso";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/session-verify";
import { logAdminAction } from "@/lib/admin-auth";
import { getPublicOrigin } from "@/lib/sso-config";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | null | undefined): string {
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

function clearSsoCookies(response: NextResponse): void {
  for (const name of [
    ADMIN_SSO_STATE_COOKIE,
    ADMIN_SSO_VERIFIER_COOKIE,
    ADMIN_SSO_RETURN_COOKIE,
  ]) {
    response.cookies.set(name, "", { ...ADMIN_SSO_COOKIE_OPTIONS, maxAge: 0 });
  }
}

function redirectToLogin(origin: string, code: string): NextResponse {
  const response = NextResponse.redirect(
    new URL(`/admin/login?error=${encodeURIComponent(code)}`, origin),
    { headers: { "Cache-Control": "no-store" } }
  );
  clearSsoCookies(response);
  return response;
}

// GET /api/admin/auth/sso/callback
// 校验 state/PKCE -> 主站换断言 -> 验签 -> upsert 影子账号 -> 本地会话
export async function GET(request: NextRequest) {
  const origin = getPublicOrigin() || new URL(request.url).origin;
  const ip = getClientIP(request);
  const limit = await rateLimit(`admin-sso-callback-${ip}`, "default", {
    maxRequests: 30,
    windowMs: 60 * 1000,
  });
  if (!limit.success) {
    return redirectToLogin(origin, "sso_rate_limited");
  }

  let config: ReturnType<typeof getAdminSsoConfig>;
  try {
    config = getAdminSsoConfig();
  } catch (error) {
    logger.error("[AdminSSO] 配置缺失", { error: String(error) });
    return redirectToLogin(origin, "sso_not_configured");
  }
  if (!config.enabled) {
    return redirectToLogin(origin, "sso_disabled");
  }

  const params = request.nextUrl.searchParams;
  const errorParam = params.get("error");
  if (errorParam) {
    return redirectToLogin(origin, "sso_denied");
  }

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get(ADMIN_SSO_STATE_COOKIE)?.value;
  const verifier = request.cookies.get(ADMIN_SSO_VERIFIER_COOKIE)?.value;
  const returnTo = safeReturnTo(
    request.cookies.get(ADMIN_SSO_RETURN_COOKIE)?.value
  );

  if (!code || !state || !expectedState || !verifier || state !== expectedState) {
    return redirectToLogin(origin, "sso_state");
  }

  try {
    const assertion = await exchangeAdminSsoCode(code, verifier, config);
    const claims = await verifyAdminSsoAssertion(assertion, config);
    const localRole = resolveLocalAdminRole(claims);
    if (!localRole) {
      return redirectToLogin(origin, "sso_forbidden");
    }

    const shadow = await upsertShadowAdmin(claims, localRole);
    const { cookieValue, maxAgeSeconds } = await createSsoAdminSession(
      shadow,
      claims,
      config,
      shadow.passwordChangedAt?.toISOString() ?? null
    );

    const response = NextResponse.redirect(new URL(returnTo, origin), {
      headers: { "Cache-Control": "no-store" },
    });
    clearSsoCookies(response);
    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: maxAgeSeconds,
    });

    await logAdminAction({
      adminId: shadow.id,
      action: "login_sso",
      resource: "AdminUser",
      resourceId: shadow.id,
      details: {
        externalAdminId: claims.sub,
        email: claims.email,
        mainRole: claims.role,
        localRole,
        totpEnabled: claims.totp,
      },
      ip,
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return response;
  } catch (error) {
    if (error instanceof AdminSsoError) {
      logger.warn("[AdminSSO] callback failed", {
        code: error.code,
        status: error.status,
      });
      const map: Record<string, string> = {
        MAIN_SESSION_EXPIRED: "sso_expired",
        TOKEN_ENDPOINT_UNREACHABLE: "sso_unreachable",
        EMAIL_CONFLICT: "sso_conflict",
        INVALID_ASSERTION: "sso_failed",
        ASSERTION_REPLAYED: "sso_failed",
        TOKEN_EXCHANGE_FAILED: "sso_failed",
      };
      return redirectToLogin(origin, map[error.code] || "sso_failed");
    }
    logger.error("[AdminSSO] callback unexpected error", {
      error: String(error),
    });
    return redirectToLogin(origin, "sso_failed");
  }
}
