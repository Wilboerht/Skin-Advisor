
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminSession, logAdminAction, getClientInfo } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const cookieStore = await cookies();
        cookieStore.delete("admin_session");

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
