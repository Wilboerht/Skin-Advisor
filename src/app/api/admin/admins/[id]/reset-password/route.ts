import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, logAdminAction, getClientInfo } from "@/lib/admin-auth";
import { AdminRole } from "@/lib/permissions";
import bcrypt from "bcryptjs";

// POST /api/admin/admins/[id]/reset-password
export const POST = requireRole(AdminRole.SUPER_ADMIN)(async (request, { admin, params }) => {
    try {
        const { id } = await params;
        const body = await request.json();
        const { password } = body;

        if (!password || typeof password !== "string" || password.length < 6) {
            return NextResponse.json(
                { success: false, error: "密码至少6个字符" },
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

        // Cannot reset own password via this endpoint (use profile page instead)
        if (id === admin.adminId) {
            return NextResponse.json(
                { success: false, error: "请使用个人资料页面修改自己的密码" },
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await prisma.adminUser.update({
            where: { id },
            data: {
                password: hashedPassword,
                passwordChangedAt: new Date(),
            },
        });

        // Log audit
        const clientInfo = getClientInfo(request);
        await logAdminAction({
            adminId: admin.adminId,
            action: "reset_password",
            resource: "AdminUser",
            resourceId: id,
            details: { username: targetAdmin.username },
            ...clientInfo,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Admin reset password error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to reset password" },
            { status: 500 }
        );
    }
});
