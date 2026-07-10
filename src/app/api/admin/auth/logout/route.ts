
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminSession, logAdminAction, getClientInfo } from "@/lib/admin-auth";
import { ADMIN_SESSION_COOKIE_NAME, revokeAdminSessions } from "@/lib/session-verify";

export async function POST(request: NextRequest) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 服务端撤销当前会话，防止 Cookie 被窃取后继续使用
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
        console.error("Admin logout error:", error);
        return NextResponse.json({ error: "Logout failed" }, { status: 500 });
    }
}
