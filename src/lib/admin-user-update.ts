/**
 * 管理端更新子站用户（主站控制中台 → 子站内部接口）
 *
 * 仅允许两类变更：每日测肤上限、子站账号禁用/启用。
 * 禁用/启用会递增 tokenVersion 并撤销本地 refresh token，避免旧会话继续使用。
 */
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getClientInfo, logAdminAction } from "@/lib/admin-auth";
import { UserRole, isDisabledUser, isValidUserRole } from "@/lib/permissions";

export interface AdminUserPatch {
    dailyTestLimit?: number;
    role?: "user" | "disabled";
}

export interface AdminOperator {
    id: string;
    email?: string | null;
    name?: string | null;
}

export interface AdminUserUpdateInput {
    userId: string;
    patch: AdminUserPatch;
    operator: AdminOperator;
    mainAuditId?: string | null;
    request: NextRequest;
}

export interface AdminUserSnapshot {
    role: string;
    dailyTestLimit: number;
}

export type AdminUserUpdateResult =
    | { found: false }
    | {
          found: true;
          changed: boolean;
          previous: AdminUserSnapshot;
          current: AdminUserSnapshot;
          revokedRefreshTokens: number;
      };

interface UserRow {
    id: string;
    role: string;
    previousRole: string | null;
    dailyTestLimit: number;
}

function toSnapshot(user: Pick<UserRow, "role" | "dailyTestLimit">): AdminUserSnapshot {
    return { role: user.role, dailyTestLimit: user.dailyTestLimit };
}

function resolveRestoredRole(previousRole: string | null): string {
    if (previousRole && isValidUserRole(previousRole) && !isDisabledUser(previousRole)) {
        return previousRole;
    }
    return UserRole.USER;
}

export async function updateAdminUser(input: AdminUserUpdateInput): Promise<AdminUserUpdateResult> {
    const { userId, patch, operator, mainAuditId, request } = input;

    const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                role: true,
                previousRole: true,
                dailyTestLimit: true,
            },
        });
        if (!user) return null;

        const data: Prisma.UserUpdateInput = {};
        let changed = false;
        let roleChanged = false;

        if (
            patch.dailyTestLimit !== undefined &&
            patch.dailyTestLimit !== user.dailyTestLimit
        ) {
            data.dailyTestLimit = patch.dailyTestLimit;
            changed = true;
        }

        if (patch.role === "disabled" && !isDisabledUser(user.role)) {
            data.role = UserRole.DISABLED;
            data.previousRole = user.role;
            data.tokenVersion = { increment: 1 };
            changed = true;
            roleChanged = true;
        } else if (patch.role === "user" && isDisabledUser(user.role)) {
            data.role = resolveRestoredRole(user.previousRole);
            data.previousRole = null;
            data.tokenVersion = { increment: 1 };
            changed = true;
            roleChanged = true;
        }

        if (!changed) {
            return {
                changed: false,
                previous: toSnapshot(user),
                current: toSnapshot(user),
                revokedRefreshTokens: 0,
            };
        }

        const updated = await tx.user.update({
            where: { id: userId },
            data,
            select: { role: true, dailyTestLimit: true },
        });

        let revokedRefreshTokens = 0;
        if (roleChanged) {
            const revoked = await tx.refreshToken.updateMany({
                where: { userId, revokedAt: null },
                data: { revokedAt: new Date() },
            });
            revokedRefreshTokens = revoked.count;
        }

        return {
            changed: true,
            previous: toSnapshot(user),
            current: toSnapshot(updated),
            revokedRefreshTokens,
        };
    });

    if (!result) return { found: false };

    let adminId: string | null = null;
    try {
        const shadow = await prisma.adminUser.findUnique({
            where: { externalAdminId: operator.id },
            select: { id: true },
        });
        adminId = shadow?.id ?? null;
    } catch {
        adminId = null;
    }

    let clientInfo: { ip?: string; userAgent?: string } = {
        userAgent: request.headers.get("user-agent") || "unknown",
    };
    try {
        clientInfo = getClientInfo(request);
    } catch {
        // IP 解析失败不阻断已完成的写操作
    }

    await logAdminAction({
        adminId,
        action: "update",
        resource: "User",
        resourceId: userId,
        details: {
            source: "main-console",
            mainAuditId: mainAuditId ?? null,
            operator: {
                id: operator.id,
                email: operator.email ?? null,
                name: operator.name ?? null,
            },
            previous: {
                role: result.previous.role,
                dailyTestLimit: result.previous.dailyTestLimit,
            },
            current: {
                role: result.current.role,
                dailyTestLimit: result.current.dailyTestLimit,
            },
            changed: result.changed,
            revokedRefreshTokens: result.revokedRefreshTokens,
        },
        ...clientInfo,
    });

    return { found: true, ...result };
}
