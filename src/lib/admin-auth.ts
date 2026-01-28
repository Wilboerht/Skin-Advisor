
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

        // Parse session data (stored as JSON in cookie)
        const sessionData = JSON.parse(sessionCookie.value);

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
