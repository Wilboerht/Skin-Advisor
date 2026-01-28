
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { logAdminAction, getClientInfo } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
    const clientInfo = getClientInfo(request);

    try {
        const { username, password } = await request.json();

        const admin = await prisma.adminUser.findUnique({
            where: { username }
        });

        if (!admin || admin.password !== password) {
            // Log failed login attempt
            await logAdminAction({
                action: "login_failed",
                resource: "AdminUser",
                details: { username },
                ...clientInfo
            });

            return NextResponse.json(
                { error: "Invalid credentials" },
                { status: 401 }
            );
        }

        // Set cookie with JSON session data
        const sessionData = JSON.stringify({
            adminId: admin.id,
            username: admin.username,
            role: admin.role
        });

        const cookieStore = await cookies();
        cookieStore.set("admin_session", sessionData, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 // 1 day
        });

        // Log successful login
        await logAdminAction({
            adminId: admin.id,
            action: "login",
            resource: "AdminUser",
            resourceId: admin.id,
            details: { username: admin.username },
            ...clientInfo
        });

        return NextResponse.json({
            success: true,
            user: { name: admin.name, role: admin.role }
        });

    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
