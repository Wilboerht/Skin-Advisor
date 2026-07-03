
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { cache } from "react";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getClientIP } from "@/lib/ratelimit";
import { verifySessionSignature, createSignedSession, ADMIN_SESSION_COOKIE_NAME } from "@/lib/session-verify";
import { logger } from "@/lib/logger";

interface AdminSession {
    adminId: string;
    username: string;
    role: string;
}

/**
 * Verify admin session from cookies (per-request cached via React.cache)
 * Returns admin info if valid, null otherwise.
 * Layout and pages can both call this without redundant DB queries.
 */
export const verifyAdminSession = cache(async (): Promise<AdminSession | null> => {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE_NAME);

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
            select: { id: true, username: true, role: true, active: true, passwordChangedAt: true }
        });

        if (!admin || !admin.active) {
            return null;
        }

        // If password has been changed since session was issued, invalidate the session
        const sessionPasswordChangedAt = sessionData.passwordChangedAt as string | null | undefined;
        const currentPasswordChangedAt = admin.passwordChangedAt?.toISOString() || null;
        if (sessionPasswordChangedAt !== currentPasswordChangedAt) {
            return null;
        }

        return {
            adminId: admin.id,
            username: admin.username,
            role: admin.role
        };
    } catch (error) {
        logger.error("Session verification error", { error: String(error) });
        return null;
    }
});

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
        logger.error("[SECURITY] Failed to log audit action", { error: String(error) });
        // Don't throw - audit logging should not break main functionality
        // But ops should be alerted: audit trail gaps indicate DB or infra issues
    }
}

export const VALID_ADMIN_ROLES = ["super_admin", "admin"];

/**
 * Higher-order function to wrap API route handlers with admin auth.
 * Delegates to requireRole() with all valid roles (effectively role-agnostic).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAdminAuth<T = any>(
    handler: (request: NextRequest, context: T & { admin: AdminSession }) => Promise<NextResponse>
): (request: NextRequest, context: T) => Promise<NextResponse> {
    return requireRole(...VALID_ADMIN_ROLES)(handler);
}

/**
 * Require specific role(s) for API route handlers.
 * Returns a wrapper that checks admin authentication AND role membership.
 */
export function requireRole(...allowedRoles: string[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                logger.warn(`[Security] Role forbidden`, { role: admin.role, allowed: allowedRoles });
                return NextResponse.json(
                    { success: false, error: "Forbidden" },
                    { status: 403 }
                );
            }

            return handler(request, { ...context, admin });
        };
    };
}

// Re-export shared crypto functions for consumers that need them directly
export { createSignedSession };
