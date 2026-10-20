import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  AdminSsoError,
  fetchMainAdminStatuses,
  getAdminSsoConfig,
  type MainAdminStatus,
} from "@/lib/admin-sso";
import { logAdminAction } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

const BATCH_SIZE = 100;

function authorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

function localRoleFromStatus(status: MainAdminStatus): "super_admin" | "admin" | null {
  if (status.advisorRole === "super_admin") return "super_admin";
  if (status.advisorRole === "admin") return "admin";
  return null;
}

// GET /api/cron/admin-sso-sync
// 每 5 分钟同步主站管理员状态/角色/权限版本；禁用/改权后撤销子站会话。
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.ADMIN_SSO_ENABLED === "false") {
    return NextResponse.json({ success: true, skipped: true, reason: "sso_disabled" });
  }

  let config: ReturnType<typeof getAdminSsoConfig>;
  try {
    config = getAdminSsoConfig();
  } catch (error) {
    logger.error("[AdminSSOSync] 配置缺失", { error: String(error) });
    return NextResponse.json(
      { success: false, error: "Admin SSO is not configured" },
      { status: 500 }
    );
  }

  const shadowAdmins = await prisma.adminUser.findMany({
    where: { authSource: "sso", externalAdminId: { not: null } },
    select: {
      id: true,
      externalAdminId: true,
      externalTokenVersion: true,
      externalRole: true,
      role: true,
      active: true,
      mainTotpEnabled: true,
    },
    orderBy: { id: "asc" },
  });

  if (shadowAdmins.length === 0) {
    return NextResponse.json({ success: true, updated: 0, revoked: 0 });
  }

  let updated = 0;
  let revoked = 0;
  const now = new Date();

  try {
    for (let offset = 0; offset < shadowAdmins.length; offset += BATCH_SIZE) {
      const batch = shadowAdmins.slice(offset, offset + BATCH_SIZE);
      const ids = batch
        .map((admin) => admin.externalAdminId)
        .filter((id): id is string => Boolean(id));
      const statuses = await fetchMainAdminStatuses(ids, config);
      const statusById = new Map(statuses.map((status) => [status.id, status]));

      for (const shadow of batch) {
        const status = shadow.externalAdminId
          ? statusById.get(shadow.externalAdminId)
          : undefined;

        if (
          !status ||
          status.status !== "ACTIVE" ||
          status.deletedAt ||
          !status.advisorRole
        ) {
          if (shadow.active) {
            await prisma.adminUser.update({
              where: { id: shadow.id },
              data: {
                active: false,
                sessionRevokedAt: now,
                lastSyncedAt: now,
              },
            });
            revoked += 1;
            await logAdminAction({
              adminId: null,
              action: "admin_sso_sync_revoke",
              resource: "AdminUser",
              resourceId: shadow.id,
              details: {
                reason: !status ? "not_found" : "inactive_or_no_access",
                externalAdminId: shadow.externalAdminId,
              },
              ip: "cron",
              userAgent: "admin-sso-sync",
            });
          } else {
            await prisma.adminUser.update({
              where: { id: shadow.id },
              data: { lastSyncedAt: now },
            });
          }
          continue;
        }

        const localRole = localRoleFromStatus(status);
        if (!localRole) {
          if (shadow.active) {
            await prisma.adminUser.update({
              where: { id: shadow.id },
              data: {
                active: false,
                sessionRevokedAt: now,
                lastSyncedAt: now,
              },
            });
            revoked += 1;
          }
          continue;
        }

        const versionMissing = shadow.externalTokenVersion === null;
        const versionChanged =
          shadow.externalTokenVersion !== null &&
          shadow.externalTokenVersion !== status.ver;
        // active=false 但主站已重新启用时也要恢复；versionMissing 时先补写版本，
        // 避免影子账号永远停留在 null 导致后续版本变化检测失效。
        const roleChanged =
          shadow.role !== localRole ||
          shadow.externalRole !== status.role ||
          shadow.mainTotpEnabled !== status.totpEnabled ||
          versionMissing ||
          !shadow.active;

        if (versionChanged) {
          await prisma.adminUser.update({
            where: { id: shadow.id },
            data: {
              role: localRole,
              externalRole: status.role,
              externalTokenVersion: status.ver,
              mainTotpEnabled: status.totpEnabled,
              active: true,
              sessionRevokedAt: now,
              lastSyncedAt: now,
            },
          });
          revoked += 1;
          updated += 1;
          await logAdminAction({
            adminId: null,
            action: "admin_sso_sync_revoke",
            resource: "AdminUser",
            resourceId: shadow.id,
            details: {
              reason: "token_version_changed",
              externalAdminId: shadow.externalAdminId,
              role: localRole,
            },
            ip: "cron",
            userAgent: "admin-sso-sync",
          });
        } else if (roleChanged) {
          await prisma.adminUser.update({
            where: { id: shadow.id },
            data: {
              role: localRole,
              externalRole: status.role,
              externalTokenVersion: status.ver,
              mainTotpEnabled: status.totpEnabled,
              active: true,
              lastSyncedAt: now,
            },
          });
          updated += 1;
          await logAdminAction({
            adminId: null,
            action: "admin_sso_sync_update",
            resource: "AdminUser",
            resourceId: shadow.id,
            details: {
              externalAdminId: shadow.externalAdminId,
              role: localRole,
              mainRole: status.role,
            },
            ip: "cron",
            userAgent: "admin-sso-sync",
          });
        } else {
          await prisma.adminUser.update({
            where: { id: shadow.id },
            data: { lastSyncedAt: now },
          });
        }
      }
    }
  } catch (error) {
    if (error instanceof AdminSsoError) {
      logger.error("[AdminSSOSync] 主站状态接口失败", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { success: false, error: "主站状态同步失败", code: error.code },
        { status: 502 }
      );
    }
    logger.error("[AdminSSOSync] sync failed", { error: String(error) });
    return NextResponse.json(
      { success: false, error: "同步失败" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    checked: shadowAdmins.length,
    updated,
    revoked,
  });
}
