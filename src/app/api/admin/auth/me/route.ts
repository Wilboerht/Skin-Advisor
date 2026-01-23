
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("admin_session")?.value;

    if (!sessionId) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const admin = await prisma.adminUser.findUnique({
        where: { id: sessionId }
    });

    if (!admin) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
        authenticated: true,
        user: {
            id: admin.id,
            name: admin.name,
            username: admin.username,
            role: admin.role
        }
    });
}
