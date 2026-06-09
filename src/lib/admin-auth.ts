
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getClientIP } from "@/lib/ratelimit";
import { verifySessionSignature, createSignedSession } from "@/lib/session-verify";

interface AdminSession {
    adminId: string;
    username: string;
    role: string;
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

        // Verify signature and parse session data (uses Web Crypto, unified with Edge middleware)
        const sessionData = await verifySessionSignature(sessionCookie.value);

        if (!sessionData?.adminId) {
            return null;
        }

        // Verify admin exists and is active in database
        const admin = await prisma.adminUser.findUnique({
            where: { id: sessionData.adminId as string },
            select: { id: true, username: true, role: true, active: true }
        });

        if (!admin || !admin.active) {
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
        ip: getClientIP(request),
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
    details?: Prisma.JsonValue;
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
                details: params.details ?? undefined,
                ip: params.ip,
                userAgent: params.userAgent,
            }
        });
    } catch (error) {
        console.error("🔴 [SECURITY] Failed to log audit action:", error);
        // Don't throw - audit logging should not break main functionality
        // But ops should be alerted: audit trail gaps indicate DB or infra issues
    }
}

/**
 * Higher-order function to wrap API route handlers with admin auth
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAdminAuth<T = any>(
    handler: (request: NextRequest, context: T & { admin: AdminSession }) => Promise<NextResponse>
): (request: NextRequest, context: T) => Promise<NextResponse> {
    return async (request: NextRequest, context: T) => {
        const admin = await verifyAdminSession();

        if (!admin) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        return handler(request, { ...context, admin });
    };
}

/**
 * Require specific role(s) for API route handlers.
 * Returns a wrapper that checks admin authentication AND role membership.
 */
export function requireRole(...allowedRoles: string[]) {
    return function <T = any>(
        handler: (request: NextRequest, context: T & { admin: AdminSession }) => Promise<NextResponse>
    ): (request: NextRequest, context: T) => Promise<NextResponse> {
        return async (request: NextRequest, context: T) => {
            const admin = await verifyAdminSession();

            if (!admin) {
                return NextResponse.json(
                    { success: false, error: "Unauthorized" },
                    { status: 401 }
                );
            }

            if (!allowedRoles.includes(admin.role)) {
                console.warn(`[Security] Role forbidden: ${admin.role} not in [${allowedRoles.join(", ")}]`);
                return NextResponse.json(
                    { success: false, error: "Forbidden" },
                    { status: 403 }
                );
            }

            return handler(request, { ...context, admin });
        };
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

// Re-export shared crypto functions for consumers that need them directly
export { createSignedSession };
