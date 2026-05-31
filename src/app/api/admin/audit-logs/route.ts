
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { Prisma } from "@prisma/client";

// GET /api/admin/audit-logs - List audit logs with filtering
// Available to all authenticated admin roles (including editor)
export const GET = withAdminAuth(async (request) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-audit-logs-${ip}`, "default", { maxRequests: 60, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
        const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
        const action = searchParams.get("action");
        const resource = searchParams.get("resource");
        const adminId = searchParams.get("adminId");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const skip = (page - 1) * limit;

        const whereCondition: Prisma.AdminAuditLogWhereInput = {};

        // Action filter
        if (action && action !== "all") {
            whereCondition.action = action;
        }

        // Resource filter
        if (resource && resource !== "all") {
            whereCondition.resource = resource;
        }

        // Admin filter
        if (adminId && adminId !== "all") {
            whereCondition.adminId = adminId;
        }

        // Date range filter
        if (startDate || endDate) {
            whereCondition.createdAt = {};
            if (startDate) {
                const d = new Date(startDate);
                if (isNaN(d.getTime())) {
                    return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
                }
                whereCondition.createdAt.gte = d;
            }
            if (endDate) {
                const d = new Date(endDate);
                if (isNaN(d.getTime())) {
                    return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
                }
                // Include the entire end date (add 1 day)
                d.setDate(d.getDate() + 1);
                whereCondition.createdAt.lte = d;
            }
        }

        // Fetch logs and admin list in parallel
        const [logs, total, admins] = await Promise.all([
            prisma.adminAuditLog.findMany({
                where: whereCondition,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    admin: {
                        select: { username: true, name: true }
                    }
                }
            }),
            prisma.adminAuditLog.count({ where: whereCondition }),
            // Get list of admins for filter dropdown
            prisma.adminUser.findMany({
                select: { id: true, username: true, name: true },
                orderBy: { username: 'asc' }
            })
        ]);

        // Get unique actions and resources for filter dropdowns
        // NOTE: distinct queries can be slow on large tables; consider caching these values
        const [actionsResult, resourcesResult] = await Promise.all([
            prisma.adminAuditLog.findMany({
                distinct: ['action'],
                select: { action: true }
            }),
            prisma.adminAuditLog.findMany({
                distinct: ['resource'],
                select: { resource: true }
            })
        ]);

        return NextResponse.json({
            success: true,
            data: logs,
            filters: {
                admins,
                actions: actionsResult.map(a => a.action),
                resources: resourcesResult.map(r => r.resource)
            },
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Failed to fetch audit logs:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
});
