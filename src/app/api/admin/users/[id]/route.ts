import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, getClientInfo, logAdminAction } from "@/lib/admin-auth";
import { canViewFullPII, UserRole, isValidUserRole, AdminRole } from "@/lib/permissions";
import { incrementTokenVersion } from "@/lib/auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { Prisma } from "@prisma/client";

// GET /api/admin/users/[id] - Get user details
// Available to super_admin and admin
export const GET = requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)(async (
    request: NextRequest,
    { admin, params }
) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-user-get-${ip}`, "default", { maxRequests: 60, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const { id } = await params;

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                previousRole: true,
                avatarUrl: true,
                dailyTestLimit: true,
                createdAt: true,
                updatedAt: true,
                advisorSessions: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                    select: {
                        id: true,
                        createdAt: true,
                        completedAt: true,
                        analysisSource: true,
                        resultShared: true,
                        shareMethod: true,
                        deviceType: true,
                        province: true,
                    }
                },
                _count: {
                    select: { advisorSessions: true }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // PII 保护：非 super_admin 脱敏邮箱和手机号
        if (!canViewFullPII(admin.role)) {
            return NextResponse.json({
                ...user,
                email: user.email ? `${user.email.charAt(0)}***@${user.email.split('@')[1] || '***'}` : null,
            });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error("Admin user GET error:", error);
        return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
    }
});

// PATCH /api/admin/users/[id] - Update user (disable/enable, update role, dailyTestLimit)
export const PATCH = requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)(async (
    request: NextRequest,
    { admin, params }
) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-user-patch-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const { id } = await params;
        const body = await request.json();
        const { role, name, dailyTestLimit } = body;

        // Validate name length
        if (name !== undefined && (typeof name !== "string" || name.length > 200)) {
            return NextResponse.json({ error: "Invalid name (max 200 chars)" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const VALID_ROLES = [UserRole.USER, UserRole.DISABLED] as const;
// 保持运行时数组以便 include 检查（显式声明为 string[] 避免 TypeScript 字面量元组限制）
const RUNTIME_USER_ROLES: string[] = [UserRole.USER, UserRole.DISABLED];
        if (role !== undefined) {
            if (!VALID_ROLES.includes(role)) {
                return NextResponse.json({ error: "Invalid role" }, { status: 400 });
            }
        }

        if (dailyTestLimit !== undefined) {
            const limitNum = Number(dailyTestLimit);
            if (
                !Number.isFinite(limitNum) ||
                !Number.isInteger(limitNum) ||
                limitNum < 0 ||
                limitNum > 9999
            ) {
                return NextResponse.json(
                    { error: "Invalid dailyTestLimit (must be an integer 0-9999)" },
                    { status: 400 }
                );
            }
        }

        // Build update data with previousRole logic for disable/enable
        const updateData: Prisma.UserUpdateInput = {};
        if (name !== undefined) updateData.name = name;
        if (dailyTestLimit !== undefined) updateData.dailyTestLimit = Number(dailyTestLimit);

        let actualNewRole: string | undefined;

        if (role !== undefined) {
            if (role === UserRole.DISABLED && user.role !== UserRole.DISABLED) {
                // Disabling user: save current role to previousRole
                updateData.role = UserRole.DISABLED;
                updateData.previousRole = user.role;
                actualNewRole = UserRole.DISABLED;
            } else if (role !== UserRole.DISABLED && user.role === UserRole.DISABLED) {
                // Enabling user: restore previousRole if available
                // Security: do NOT silently fallback to "user" if previousRole is missing.
                // This prevents accidental role demotion.
                const restoredRole = user.previousRole;
                if (restoredRole && RUNTIME_USER_ROLES.includes(restoredRole)) {
                    updateData.role = restoredRole;
                    actualNewRole = restoredRole;
                } else {
                    // previousRole missing or invalid — accept explicit role from client
                    if (!role || !RUNTIME_USER_ROLES.includes(role)) {
                        return NextResponse.json(
                            { error: "previousRole missing or invalid. Please explicitly specify a valid role." },
                            { status: 400 }
                        );
                    }
                    updateData.role = role;
                    actualNewRole = role;
                }
                updateData.previousRole = null;
            } else {
                // Normal role change (not disable/enable toggle)
                updateData.role = role;
                actualNewRole = role;
            }
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData,
        });

        // 禁用/启用/角色变更时撤销该用户现有 JWT
        if (actualNewRole !== undefined) {
            await incrementTokenVersion(id);
        }

        // Log admin action
        const clientInfo = getClientInfo(request);
        await logAdminAction({
            adminId: admin.adminId,
            action: "update",
            resource: "User",
            resourceId: id,
            details: {
                previousRole: user.role,
                newRole: actualNewRole,
                previousDailyTestLimit: user.dailyTestLimit,
                newDailyTestLimit: dailyTestLimit,
                restoredFromPreviousRole: user.previousRole || null,
            },
            ...clientInfo,
        });

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error("Admin user PATCH error:", error);
        return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
});

// DELETE /api/admin/users/[id] - Delete user
export const DELETE = requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)(async (
    request: NextRequest,
    { admin, params }
) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-user-delete-${ip}`, "default", { maxRequests: 20, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const { id } = await params;

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        await prisma.user.delete({ where: { id } });

        // Log admin action
        const clientInfo = getClientInfo(request);
        await logAdminAction({
            adminId: admin.adminId,
            action: "delete",
            resource: "User",
            resourceId: id,
            details: { email: user.email, name: user.name },
            ...clientInfo,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Admin user DELETE error:", error);
        return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
    }
});
