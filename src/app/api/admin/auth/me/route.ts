
import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
    try {
        const admin = await verifyAdminSession();

        if (!admin) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }

        const adminFromDb = await prisma.adminUser.findUnique({
            where: { id: admin.adminId },
            select: { name: true }
        });

        return NextResponse.json({
            authenticated: true,
            user: {
                id: admin.adminId,
                name: adminFromDb?.name || admin.username,
                username: admin.username,
                role: admin.role
            }
        });
    } catch (error) {
        logger.error("Admin me error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
