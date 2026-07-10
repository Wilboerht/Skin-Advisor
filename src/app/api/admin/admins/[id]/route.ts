import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import prisma from "@/lib/prisma";
import { requireRole, logAdminAction, getClientInfo } from "@/lib/admin-auth";
import { AdminRole, VALID_ADMIN_ROLES, isSuperAdmin } from "@/lib/permissions";
import bcrypt from "bcryptjs";
import { logger } from "@/lib/logger";

// PATCH /api/admin/admins/[id] - Update admin info
export const PATCH = requireRole(AdminRole.SUPER_ADMIN)(async (request, { admin, params }) => {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, email, role, password, active } = body;

        // Validate active type to prevent string/boolean confusion
        if (active !== undefined && typeof active !== "boolean") {
            return apiError(ErrorCode.VALIDATION_ERROR, "active 必须是布尔值", 400);
        }

        // Validate role
        if (role !== undefined && !VALID_ADMIN_ROLES.includes(role)) {
            return apiError(ErrorCode.VALIDATION_ERROR, "无效的角色", 400);
        }

        // Validate email
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email !== undefined && email !== null && (typeof email !== "string" || !EMAIL_REGEX.test(email))) {
            return apiError(ErrorCode.VALIDATION_ERROR, "无效的邮箱格式", 400);
        }

        // Validate and hash password if provided (outside transaction to avoid holding locks)
        let hashedPassword: string | undefined;
        if (password !== undefined && password !== null && password !== "") {
            if (typeof password !== "string" || password.length < 6) {
                return apiError(ErrorCode.VALIDATION_ERROR, "密码至少6个字符", 400);
            }
            hashedPassword = await bcrypt.hash(password, 12);
        }

        // Atomic transaction with SELECT FOR UPDATE to prevent race conditions
        // when demoting/disabling the last active super_admin.
        const txResult = await prisma.$transaction(async (tx) => {
            // Lock the target row for the duration of the transaction
            const lockedTargets = await tx.$queryRaw<{ id: string; role: string; active: boolean; name: string | null; email: string | null; username: string }[]>`
                SELECT id, role, active, name, email, username FROM "AdminUser" WHERE id = ${id} FOR UPDATE
            `;
            const targetAdmin = lockedTargets[0];
            if (!targetAdmin) {
                return { error: "管理员不存在", status: 404 };
            }

            // Check email uniqueness (excluding self)
            if (email && email !== targetAdmin.email) {
                const existing = await tx.adminUser.findFirst({
                    where: { email, NOT: { id } },
                });
                if (existing) {
                    return { error: "邮箱已被使用", status: 409 };
                }
            }

            // Prevent demotion/disabling of the last active super_admin
            const targetIsSuperAdmin = isSuperAdmin(targetAdmin.role);
            const needsGuard =
                (role !== undefined && targetIsSuperAdmin && !isSuperAdmin(role)) ||
                (active !== undefined && targetIsSuperAdmin && active === false);

            if (needsGuard) {
                // Lock all active super_admins to serialize concurrent modifications
                const activeSuperAdmins = await tx.$queryRaw<{ id: string }[]>`
                    SELECT id FROM "AdminUser" WHERE role = ${AdminRole.SUPER_ADMIN} AND active = true FOR UPDATE
                `;
                if (activeSuperAdmins.length <= 1) {
                    return { error: "不能降级或禁用最后一个活跃的超级管理员", status: 400 };
                }
            }

            const updated = await tx.adminUser.update({
                where: { id },
                data: {
                    ...(name !== undefined && { name: name || null }),
                    ...(email !== undefined && { email: email || null }),
                    ...(role !== undefined && { role }),
                    ...(hashedPassword && { password: hashedPassword }),
                    ...(active !== undefined && { active }),
                },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    name: true,
                    role: true,
                    active: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            return { updated, targetAdmin };
        });

        if ("error" in txResult) {
            return apiError("ERROR", txResult.error as string, txResult.status as number);
        }

        const { updated, targetAdmin } = txResult;

        // Log audit
        const clientInfo = getClientInfo(request);
        await logAdminAction({
            adminId: admin.adminId,
            action: "update",
            resource: "AdminUser",
            resourceId: id,
            details: {
                previousName: targetAdmin.name,
                newName: name,
                previousEmail: targetAdmin.email,
                newEmail: email,
                previousRole: targetAdmin.role,
                newRole: role,
                previousActive: targetAdmin.active,
                newActive: active,
                passwordChanged: !!hashedPassword,
            },
            ...clientInfo,
        });

        return NextResponse.json({ success: true, admin: updated });
    } catch (error) {
        logger.error("Admin update error:", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "Failed to update admin", 500);
    }
});

// DELETE /api/admin/admins/[id] - Delete admin
export const DELETE = requireRole(AdminRole.SUPER_ADMIN)(async (request, { admin, params }) => {
    try {
        const { id } = await params;

        // Cannot delete self
        if (id === admin.adminId) {
            return apiError(ErrorCode.VALIDATION_ERROR, "不能删除自己的账号", 400);
        }

        const targetAdmin = await prisma.adminUser.findUnique({ where: { id } });
        if (!targetAdmin) {
            return apiError(ErrorCode.NOT_FOUND, "管理员不存在", 404);
        }

        // Cannot delete the last active super_admin
        if (isSuperAdmin(targetAdmin.role)) {
            const activeSuperAdminCount = await prisma.adminUser.count({
                where: { role: AdminRole.SUPER_ADMIN, active: true },
            });
            if (activeSuperAdminCount <= 1) {
                return apiError(ErrorCode.VALIDATION_ERROR, "不能删除最后一个活跃的超级管理员", 400);
            }
        }

        await prisma.adminUser.delete({ where: { id } });

        // Log audit
        const clientInfo = getClientInfo(request);
        await logAdminAction({
            adminId: admin.adminId,
            action: "delete",
            resource: "AdminUser",
            resourceId: id,
            details: { username: targetAdmin.username, name: targetAdmin.name, role: targetAdmin.role },
            ...clientInfo,
        });

        return apiSuccess();
    } catch (error) {
        logger.error("Admin delete error:", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "Failed to delete admin", 500);
    }
});
