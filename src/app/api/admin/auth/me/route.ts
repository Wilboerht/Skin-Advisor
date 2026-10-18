
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
            select: {
                name: true,
                authSource: true,
                externalAdminId: true,
                mainTotpEnabled: true,
            }
        });

        return NextResponse.json({
            authenticated: true,
            user: {
                id: admin.adminId,
                name: adminFromDb?.name || admin.username,
                username: admin.username,
                role: admin.role,
                authSource: adminFromDb?.authSource ?? admin.authSource ?? "local",
                externalAdminId: adminFromDb?.externalAdminId ?? admin.externalAdminId ?? null,
                mainTotpEnabled: adminFromDb?.mainTotpEnabled ?? admin.mainTotpEnabled ?? null,
            }
        });
    } catch (error) {
        logger.error("Admin me error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
