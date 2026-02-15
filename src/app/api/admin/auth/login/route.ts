
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { logAdminAction, getClientInfo } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
    const clientInfo = getClientInfo(request);

    try {
        const { username, password } = await request.json();

        const admin = await prisma.adminUser.findUnique({
            where: { username }
        });

        if (!admin) {
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

        // Support both bcrypt hashed passwords and legacy plaintext during migration
        let passwordValid = false;
        if (admin.password.startsWith("$2a$") || admin.password.startsWith("$2b$")) {
            // Bcrypt hashed password
            passwordValid = await bcrypt.compare(password, admin.password);
        } else {
            // Legacy plaintext password — verify and auto-upgrade to bcrypt
            passwordValid = admin.password === password;
            if (passwordValid) {
                const hashedPassword = await bcrypt.hash(password, 12);
                await prisma.adminUser.update({
                    where: { id: admin.id },
                    data: { password: hashedPassword }
                });
                console.log(`[Security] Auto-upgraded password hash for admin: ${admin.username}`);
            }
        }

        if (!passwordValid) {
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

        // Set cookie with HMAC-signed session data
        const { createSignedSession } = await import("@/lib/admin-auth");
        const signedSession = createSignedSession({
            adminId: admin.id,
            username: admin.username,
            role: admin.role
        });

        const cookieStore = await cookies();
        cookieStore.set("admin_session", signedSession, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
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
