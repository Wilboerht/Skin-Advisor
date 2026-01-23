
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();

        const admin = await prisma.adminUser.findUnique({
            where: { username }
        });

        if (!admin || admin.password !== password) {
            return NextResponse.json(
                { error: "Invalid credentials" },
                { status: 401 }
            );
        }

        // Set cookie
        // In production, use a signed JWT
        const cookieStore = await cookies();
        cookieStore.set("admin_session", admin.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 // 1 day
        });

        return NextResponse.json({ success: true, user: { name: admin.name, role: admin.role } });

    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
