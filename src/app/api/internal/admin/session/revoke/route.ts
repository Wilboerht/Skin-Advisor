import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorizeInternalRequest } from "@/lib/internal-api";
import { logAdminAction } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/admin/session/revoke?externalAdminId=...
 * 主站管理员登出时撤销对应测肤后台的本地会话。
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const auth = await authorizeInternalRequest(request, {
    legacy: "bearer-advisor-secret",
    rawBody,
  });
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.status ?? 401 });
  }

  const ip = getClientIP(request);
  const limit = await rateLimit(`internal-admin-session-revoke-${ip}`, "default", {
    maxRequests: 60,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const externalAdminId = request.nextUrl.searchParams.get("externalAdminId") || "";
  if (!externalAdminId || externalAdminId.length > 128) {
    return NextResponse.json({ error: "Invalid externalAdminId" }, { status: 400 });
  }

  try {
    const admin = await prisma.adminUser.findUnique({
      where: { externalAdminId },
      select: { id: true },
    });
    if (!admin) {
      return NextResponse.json({ success: true, data: { revoked: false } });
    }
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { sessionRevokedAt: new Date(), lastSyncedAt: new Date() },
    });
    await logAdminAction({
      adminId: null,
      action: "admin_sso_logout_revoke",
      resource: "AdminUser",
      resourceId: admin.id,
      details: { externalAdminId, reason: "main_admin_logout" },
      ip: "internal",
      userAgent: "main-site-logout",
    });
    return NextResponse.json({ success: true, data: { revoked: true } });
  } catch (error) {
    logger.error("[internal/admin/session/revoke] failed", { error: String(error) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
