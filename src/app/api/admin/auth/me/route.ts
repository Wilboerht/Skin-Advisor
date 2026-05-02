
import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";

export async function GET() {
    try {
        const admin = await verifyAdminSession();

        if (!admin) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }

        return NextResponse.json({
            authenticated: true,
            user: {
                id: admin.adminId,
                name: admin.username,
                username: admin.username,
                role: admin.role
            }
        });
    } catch (error) {
        console.error("Admin me error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
