import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";
import { ADMIN_SESSION_COOKIE_NAME, createSignedSession } from "@/lib/session-verify";
import { verifyTotp } from "@/lib/totp";
import { getPublicOrigin } from "@/lib/sso-config";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const BREAK_GLASS_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

function originOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isSameOriginRequest(req: NextRequest): boolean {
  const candidate =
    originOf(req.headers.get("origin")) ?? originOf(req.headers.get("referer"));
  if (!candidate) {
    return req.headers.get("sec-fetch-site") === "same-origin";
  }

  const allowed = new Set<string>();
  const publicOrigin = getPublicOrigin();
  if (publicOrigin) allowed.add(publicOrigin);
  for (const env of [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
  ]) {
    const origin = originOf(env);
    if (origin) allowed.add(origin);
  }
  const requestOrigin = originOf(req.url);
  if (requestOrigin) allowed.add(requestOrigin);
  return allowed.has(candidate);
}

// POST /api/admin/auth/emergency-login
// 仅 ADMIN_BREAK_GLASS_ENABLED=true 时可用；密码 + TOTP 双因素。
export async function POST(request: NextRequest) {
  if (process.env.ADMIN_BREAK_GLASS_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIP(request);
  const ipLimit = await rateLimit(`break-glass-ip-${ip}`, "login");
  if (!ipLimit.success) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  let body: { username?: unknown; password?: unknown; totpCode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const totpCode = typeof body.totpCode === "string" ? body.totpCode.trim() : "";
  const expectedUsername =
    process.env.ADMIN_BREAK_GLASS_USERNAME || "emergency-admin";

  if (!username || !password || !totpCode || username !== expectedUsername) {
    return NextResponse.json({ error: "账号或凭据错误" }, { status: 401 });
  }

  const userLimit = await rateLimit(`break-glass-user-${username}`, "login");
  if (!userLimit.success) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const admin = await prisma.adminUser.findFirst({
    where: { username, authSource: "break_glass" },
    select: {
      id: true,
      username: true,
      password: true,
      role: true,
      active: true,
      passwordChangedAt: true,
    },
  });

  const auditFailure = async (reason: string) => {
    await logAdminAction({
      adminId: admin?.id ?? null,
      action: "login_break_glass_failed",
      resource: "AdminUser",
      resourceId: admin?.id ?? null,
      details: { username, reason },
      ip,
      userAgent: request.headers.get("user-agent") || "unknown",
    });
  };

  if (!admin || !admin.active || !admin.password) {
    await auditFailure("account_unavailable");
    return NextResponse.json({ error: "账号或凭据错误" }, { status: 401 });
  }

  const passwordValid = await bcrypt.compare(password, admin.password);
  if (!passwordValid) {
    await auditFailure("invalid_password");
    return NextResponse.json({ error: "账号或凭据错误" }, { status: 401 });
  }

  const totpSecret = process.env.BREAK_GLASS_TOTP_SECRET;
  if (!totpSecret || !verifyTotp(totpSecret, totpCode)) {
    await auditFailure("invalid_totp");
    return NextResponse.json({ error: "动态验证码错误" }, { status: 401 });
  }

  try {
    const session = await createSignedSession(
      {
        adminId: admin.id,
        username: admin.username,
        role: admin.role,
        passwordChangedAt: admin.passwordChangedAt?.toISOString() ?? null,
        authSource: "break_glass",
        mainTotpEnabled: true,
      },
      { ttlMs: BREAK_GLASS_SESSION_TTL_MS }
    );

    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: Math.floor(BREAK_GLASS_SESSION_TTL_MS / 1000),
    });

    await logAdminAction({
      adminId: admin.id,
      action: "login_break_glass",
      resource: "AdminUser",
      resourceId: admin.id,
      details: { username },
      ip,
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return response;
  } catch (error) {
    logger.error("[BreakGlass] login failed", { error: String(error) });
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}
