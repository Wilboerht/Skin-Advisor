import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, logAdminAction, getClientInfo } from "@/lib/admin-auth";
import { AdminRole } from "@/lib/permissions";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { revokeAdminSessions } from "@/lib/session-verify";
import bcrypt from "bcryptjs";
import { logger } from "@/lib/logger";

// POST /api/admin/admins/[id]/reset-password
export const POST = requireRole(AdminRole.SUPER_ADMIN)(async (request, { admin, params }) => {
    try {
        const ip = getClientIP(request);
        const rc = await rateLimit(`admin-reset-password-${ip}`, "default", { maxRequests: 10, windowMs: 60 * 1000 });
        if (!rc.success) {
            return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });
        }
        const { id } = await params;
        const body = await request.json();
        const { password } = body;

        if (!password || typeof password !== "string" || password.length < 8) {
            return NextResponse.json(
                { success: false, error: "密码至少8个字符，需包含字母和数字" },
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

        // 密码修改后撤销该管理员所有现有会话，强制重新登录
        revokeAdminSessions(id);

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
        logger.error("Admin reset password error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to reset password" },
            { status: 500 }
        );
    }
});
