import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, logAdminAction, getClientInfo } from "@/lib/admin-auth";
import bcrypt from "bcryptjs";

const VALID_ROLES = ["super_admin", "admin", "editor"];

// PATCH /api/admin/admins/[id] - Update admin info
export const PATCH = requireRole("super_admin")(async (request, { admin, params }) => {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, email, role, password } = body;

        const targetAdmin = await prisma.adminUser.findUnique({ where: { id } });
        if (!targetAdmin) {
            return NextResponse.json(
                { success: false, error: "管理员不存在" },
                { status: 404 }
            );
        }

        // Validate role
        if (role !== undefined && !VALID_ROLES.includes(role)) {
            return NextResponse.json(
                { success: false, error: "无效的角色" },
                { status: 400 }
            );
        }

        // Validate email
        if (email !== undefined && email !== null && (typeof email !== "string" || !email.includes("@"))) {
            return NextResponse.json(
                { success: false, error: "无效的邮箱格式" },
                { status: 400 }
            );
        }

        // Check email uniqueness (excluding self)
        if (email && email !== targetAdmin.email) {
            const existing = await prisma.adminUser.findFirst({
                where: { email, NOT: { id } },
            });
            if (existing) {
                return NextResponse.json(
                    { success: false, error: "邮箱已被使用" },
                    { status: 409 }
                );
            }
        }

        // Validate and hash password if provided
        let hashedPassword: string | undefined;
        if (password !== undefined && password !== null && password !== "") {
            if (typeof password !== "string" || password.length < 6) {
                return NextResponse.json(
                    { success: false, error: "密码至少6个字符" },
                    { status: 400 }
                );
            }
            hashedPassword = await bcrypt.hash(password, 12);
        }

        const updated = await prisma.adminUser.update({
            where: { id },
            data: {
                ...(name !== undefined && { name: name || null }),
                ...(email !== undefined && { email: email || null }),
                ...(role !== undefined && { role }),
                ...(hashedPassword && { password: hashedPassword }),
            },
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

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
                passwordChanged: !!hashedPassword,
            },
            ...clientInfo,
        });

        return NextResponse.json({ success: true, admin: updated });
    } catch (error) {
        console.error("Admin update error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update admin" },
            { status: 500 }
        );
    }
});

// DELETE /api/admin/admins/[id] - Delete admin
export const DELETE = requireRole("super_admin")(async (request, { admin, params }) => {
    try {
        const { id } = await params;

        // Cannot delete self
        if (id === admin.adminId) {
            return NextResponse.json(
                { success: false, error: "不能删除自己的账号" },
                { status: 400 }
            );
        }

        const targetAdmin = await prisma.adminUser.findUnique({ where: { id } });
        if (!targetAdmin) {
            return NextResponse.json(
                { success: false, error: "管理员不存在" },
                { status: 404 }
            );
        }

        // Cannot delete the last super_admin
        if (targetAdmin.role === "super_admin") {
            const superAdminCount = await prisma.adminUser.count({
                where: { role: "super_admin" },
            });
            if (superAdminCount <= 1) {
                return NextResponse.json(
                    { success: false, error: "不能删除最后一个超级管理员" },
                    { status: 400 }
                );
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Admin delete error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to delete admin" },
            { status: 500 }
        );
    }
});
