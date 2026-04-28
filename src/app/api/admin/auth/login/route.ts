
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { logAdminAction, getClientInfo } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
    const clientInfo = getClientInfo(request);
    const ip = getClientIP(request);

    // Rate limit: max 5 login attempts per 15 minutes per IP
    const ipLimit = await rateLimit(`admin-login-ip-${ip}`, "login");
    if (!ipLimit.success) {
        return NextResponse.json(
            { error: "Too many login attempts. Please try again later." },
            { status: 429 }
        );
    }

    try {
        const { username, password } = await request.json();

        if (!username || !password || typeof username !== "string" || typeof password !== "string") {
            return NextResponse.json(
                { error: "Invalid request" },
                { status: 400 }
            );
        }

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

        // Account-level rate limit: max 5 attempts per 15 minutes per account
        const accountLimit = await rateLimit(`admin-login-account-${admin.id}`, "login");
        if (!accountLimit.success) {
            return NextResponse.json(
                { error: "Too many login attempts for this account. Please try again later." },
                { status: 429 }
            );
        }

        // SECURITY: Reject plaintext passwords entirely. All admin passwords MUST be bcrypt hashed.
        if (!admin.password.startsWith("$2a$") && !admin.password.startsWith("$2b$")) {
            console.error(`[Security] Admin ${admin.username} has a non-bcrypt password. Login rejected.`);
            await logAdminAction({
                action: "login_failed",
                resource: "AdminUser",
                details: { username, reason: "plaintext_password_rejected" },
                ...clientInfo
            });
            return NextResponse.json(
                { error: "Invalid credentials" },
                { status: 401 }
            );
        }

        const passwordValid = await bcrypt.compare(password, admin.password);

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
