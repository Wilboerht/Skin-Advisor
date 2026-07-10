import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { containsInsensitive } from "@/lib/prisma-search";
import { requireRole } from "@/lib/admin-auth";
import { isSuperAdmin, UserRole, AdminRole } from "@/lib/permissions";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

// PII 脱敏工具
function maskEmail(email: string): string {
    const [local, domain] = email.split("@");
    if (local.length <= 1) return `*@${domain}`;
    return `${local[0]}***@${domain}`;
}
function maskPhone(phone: string): string {
    if (phone.length < 7) return phone;
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

// GET /api/admin/users - List users with pagination and search
// Available to super_admin and admin
export const GET = requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)(async (request, { admin }) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-users-get-${ip}`, "default", { maxRequests: 60, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const isSuperAdminUser = isSuperAdmin(admin.role);

    try {
        const searchParams = request.nextUrl.searchParams;
        const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
        const search = (searchParams.get("search") || "").slice(0, 100);
        const status = searchParams.get("status") || "all"; // all, active, inactive

        const skip = (page - 1) * limit;

        const where: Prisma.UserWhereInput = {};

        if (search) {
            where.OR = [
                { email: containsInsensitive(search) },
                { name: containsInsensitive(search) },
            ];
        }

        if (status !== "all") {
            if (status === "active") {
                where.role = { not: UserRole.DISABLED };
            } else if (status === "inactive") {
                where.role = UserRole.DISABLED;
            } else {
                return NextResponse.json({ error: "Invalid status" }, { status: 400 });
            }
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                include: {
                    _count: {
                        select: { advisorSessions: true }
                    },
                    advisorSessions: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                        select: { createdAt: true, completedAt: true }
                    }
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.user.count({ where }),
        ]);

        return NextResponse.json({
            users: isSuperAdminUser ? users : users.map(u => ({
                ...u,
                email: u.email ? maskEmail(u.email) : null,
                phoneNumber: u.phoneNumber ? maskPhone(u.phoneNumber) : null,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error("Admin users error:", error);
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }
});
