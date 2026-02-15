
import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";

export async function GET() {
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
}
