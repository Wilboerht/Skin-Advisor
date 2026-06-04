import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { Prisma } from "@prisma/client";

// GET /api/admin/users - List users with pagination and search
// Available to super_admin and admin
export const GET = requireRole("super_admin", "admin")(async (request) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-users-get-${ip}`, "default", { maxRequests: 60, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const searchParams = request.nextUrl.searchParams;
        const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
        const search = (searchParams.get("search") || "").slice(0, 100);
        const status = searchParams.get("status") || "all"; // all, active, inactive, vip

        const skip = (page - 1) * limit;

        const where: Prisma.UserWhereInput = {};

        if (search) {
            where.OR = [
                { email: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
            ];
        }

        if (status !== "all") {
            if (status === "active") {
                where.role = { not: "disabled" };
            } else if (status === "inactive") {
                where.role = "disabled";
            } else if (status === "vip") {
                where.role = "vip";
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
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Admin users error:", error);
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }
});
