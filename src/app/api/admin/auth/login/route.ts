
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { logAdminAction, getClientInfo } from "@/lib/admin-auth";
import { rateLimit, getClientIP, resetRateLimit } from "@/lib/ratelimit";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/session-verify";

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

        // Rate limit: max 5 login attempts per 15 minutes per username (防止多 IP 爆破同一账号)
        const usernameLimit = await rateLimit(`admin-login-user-${username.toLowerCase()}`, "login");
        if (!usernameLimit.success) {
            return NextResponse.json(
                { error: "Too many login attempts. Please try again later." },
                { status: 429 }
            );
        }

        // Input length limits to prevent DoS
        if (username.length > 255 || password.length > 255) {
            return NextResponse.json(
                { error: "Input too long" },
                { status: 400 }
            );
        }

        const normalizedUsername = username.toLowerCase().trim();

        const INVALID_CREDENTIALS_RESPONSE = NextResponse.json(
            { error: "Invalid credentials" },
            { status: 401 }
        );

        const admin = await prisma.adminUser.findUnique({
            where: { username: normalizedUsername },
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                active: true,
                password: true,
                passwordChangedAt: true,
            }
        });

        if (!admin) {
            // Log failed login attempt
            await logAdminAction({
                action: "login_failed",
                resource: "AdminUser",
                details: { username: normalizedUsername },
                ...clientInfo
            });

            return INVALID_CREDENTIALS_RESPONSE;
        }

        // Account-level rate limit: max 5 attempts per 15 minutes per account
        const accountLimit = await rateLimit(`admin-login-account-${admin.id}`, "login");
        if (!accountLimit.success) {
            return NextResponse.json(
                { error: "Too many login attempts for this account. Please try again later." },
                { status: 429 }
            );
        }

        // SECURITY: Reject non-bcrypt passwords entirely. All admin passwords MUST be bcrypt hashed.
        if (
            !admin.password.startsWith("$2a$") &&
            !admin.password.startsWith("$2b$") &&
            !admin.password.startsWith("$2y$") &&
            !admin.password.startsWith("$2x$")
        ) {
            console.error(`[Security] Admin ${admin.username} has a non-bcrypt password. Login rejected.`);
            await logAdminAction({
                action: "login_failed",
                resource: "AdminUser",
                details: { username: normalizedUsername, reason: "plaintext_password_rejected" },
                ...clientInfo
            });
            return NextResponse.json(
                { error: "Invalid credentials" },
                { status: 401 }
            );
        }

        if (!admin.active) {
            await logAdminAction({
                action: "login_failed",
                resource: "AdminUser",
                details: { username: normalizedUsername, reason: "account_disabled" },
                ...clientInfo
            });
            return INVALID_CREDENTIALS_RESPONSE;
        }

        const passwordValid = await bcrypt.compare(password, admin.password);

        if (!passwordValid) {
            await logAdminAction({
                action: "login_failed",
                resource: "AdminUser",
                details: { username: normalizedUsername },
                ...clientInfo
            });

            return INVALID_CREDENTIALS_RESPONSE;
        }

        // Set cookie with HMAC-signed session data
        const { createSignedSession } = await import("@/lib/admin-auth");
        const signedSession = await createSignedSession({
            adminId: admin.id,
            username: admin.username,
            role: admin.role,
            passwordChangedAt: admin.passwordChangedAt?.toISOString() || null,
        });

        const cookieStore = await cookies();
        cookieStore.set(ADMIN_SESSION_COOKIE_NAME, signedSession, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 60 * 60 * 2 // 2 hours, with sliding refresh on activity
        });

        // Log successful login
        await logAdminAction({
            adminId: admin.id,
            action: "login",
            resource: "AdminUser",
            resourceId: admin.id,
            details: { username: normalizedUsername },
            ...clientInfo
        });

        const response = NextResponse.json({
            success: true,
            user: { name: admin.name, role: admin.role }
        });

        if (process.env.NODE_ENV === "production") {
            response.headers.set(
                "Strict-Transport-Security",
                "max-age=63072000; includeSubDomains; preload"
            );
        }

        return response;

    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
