
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

interface AdminSession {
    adminId: string;
    username: string;
    role: string;
}

/**
 * Get the HMAC secret for signing session cookies.
 * Falls back to a development-only default if not configured.
 */
function getSessionSecret(): string {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error(
                "🔴 CRITICAL: ADMIN_SESSION_SECRET is not set in production! " +
                "Refusing to use a fallback secret. " +
                "Set ADMIN_SESSION_SECRET in your environment variables."
            );
        }
        // Development fallback — NOT safe for production
        console.warn("⚠️  ADMIN_SESSION_SECRET not set — using development fallback. Do NOT use in production.");
        return "dev-admin-session-secret-change-me";
    }
    return secret;
}

/**
 * Sign session data with HMAC to prevent tampering
 */
export function signSessionData(data: string): string {
    const hmac = crypto.createHmac("sha256", getSessionSecret());
    hmac.update(data);
    return hmac.digest("hex");
}

/**
 * Verify HMAC signature of session data
 * Returns the parsed session data if valid, null otherwise
 */
export function verifySessionSignature(signedValue: string): Record<string, any> | null {
    try {
        const separatorIndex = signedValue.lastIndexOf(".");
        if (separatorIndex === -1) {
            // Legacy unsigned cookie — attempt to parse as plain JSON for backward compatibility
            const parsed = JSON.parse(signedValue);
            if (parsed?.adminId) {
                return parsed;
            }
            return null;
        }

        const data = signedValue.substring(0, separatorIndex);
        const signature = signedValue.substring(separatorIndex + 1);

        const expectedSignature = signSessionData(data);

        // Timing-safe comparison to prevent timing attacks
        if (
            signature.length !== expectedSignature.length ||
            !crypto.timingSafeEqual(
                Buffer.from(signature, "hex"),
                Buffer.from(expectedSignature, "hex")
            )
        ) {
            console.warn("[Security] Session cookie signature mismatch — possible tampering");
            return null;
        }

        return JSON.parse(data);
    } catch {
        return null;
    }
}

/**
 * Create a signed session cookie value
 */
export function createSignedSession(sessionData: AdminSession): string {
    const data = JSON.stringify(sessionData);
    const signature = signSessionData(data);
    return `${data}.${signature}`;
}

/**
 * Verify admin session from cookies
 * Returns admin info if valid, null otherwise
 */
export async function verifyAdminSession(): Promise<AdminSession | null> {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("admin_session");

        if (!sessionCookie?.value) {
            return null;
        }

        // Verify signature and parse session data
        const sessionData = verifySessionSignature(sessionCookie.value);

        if (!sessionData?.adminId) {
            return null;
        }

        // Verify admin exists in database
        const admin = await prisma.adminUser.findUnique({
            where: { id: sessionData.adminId },
            select: { id: true, username: true, role: true }
        });

        if (!admin) {
            return null;
        }

        return {
            adminId: admin.id,
            username: admin.username,
            role: admin.role
        };
    } catch (error) {
        console.error("Session verification error:", error);
        return null;
    }
}

/**
 * Extract client info from request
 */
export function getClientInfo(request: NextRequest) {
    return {
        ip: request.headers.get("x-forwarded-for")?.split(",")[0] ||
            request.headers.get("x-real-ip") ||
            "unknown",
        userAgent: request.headers.get("user-agent") || "unknown"
    };
}

/**
 * Log admin action to audit log
 */
export async function logAdminAction(params: {
    adminId?: string | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    details?: Record<string, any>;
    ip?: string;
    userAgent?: string;
}) {
    try {
        await prisma.adminAuditLog.create({
            data: {
                adminId: params.adminId || null,
                action: params.action,
                resource: params.resource,
                resourceId: params.resourceId || null,
                details: params.details ? params.details : undefined,
                ip: params.ip,
                userAgent: params.userAgent,
            }
        });
    } catch (error) {
        console.error("Failed to log audit action:", error);
        // Don't throw - audit logging should not break main functionality
    }
}

/**
 * Higher-order function to wrap API route handlers with admin auth
 */
export function withAdminAuth(
    handler: (
        request: NextRequest,
        context: { admin: AdminSession; params?: any }
    ) => Promise<NextResponse>
) {
    return async (request: NextRequest, context?: { params?: any }) => {
        const admin = await verifyAdminSession();

        if (!admin) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        return handler(request, { admin, params: context?.params });
    };
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse() {
    return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
    );
}
