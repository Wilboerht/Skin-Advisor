
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminSession, logAdminAction, getClientInfo } from "@/lib/admin-auth";
import { ADMIN_SESSION_COOKIE_NAME, revokeAdminSessions } from "@/lib/session-verify";
import { logger } from "@/lib/logger";
import { withDbRetry } from "@/lib/utils";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 持久化撤销时间戳到 DB（服务器重启/多实例场景下仍生效）。
        // 失败时不要静默放行：保留 Cookie 并返回 500，由用户重试，避免“看似登出但旧会话仍有效”。
        try {
            await withDbRetry(
                () =>
                    prisma.adminUser.update({
                        where: { id: admin.adminId },
                        data: { sessionRevokedAt: new Date() },
                    }),
                3,
                200
            );
        } catch (err) {
            logger.error("[Admin Logout] Failed to persist session revocation:", err);
            return NextResponse.json({ error: "Logout failed: session revocation not persisted" }, { status: 500 });
        }

        // DB 撤销成功后再撤销进程内会话并清 Cookie，避免 DB 失败时出现“cookie 已清但会话仍有效”
        revokeAdminSessions(admin.adminId);

        const cookieStore = await cookies();
        cookieStore.delete({
            name: ADMIN_SESSION_COOKIE_NAME,
            path: "/",
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
        });

        const clientInfo = getClientInfo(request);
        await logAdminAction({
            adminId: admin.adminId,
            action: "logout",
            resource: "AdminUser",
            resourceId: admin.adminId,
            details: { username: admin.username },
            ...clientInfo,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Admin logout error:", error);
        return NextResponse.json({ error: "Logout failed" }, { status: 500 });
    }
}
