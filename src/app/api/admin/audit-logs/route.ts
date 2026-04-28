
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200); // Cap at 200
        const action = searchParams.get("action");
        const resource = searchParams.get("resource");
        const adminId = searchParams.get("adminId");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const skip = (page - 1) * limit;

        const whereCondition: any = {};

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
                whereCondition.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                // Include the entire end date (add 1 day)
                const end = new Date(endDate);
                end.setDate(end.getDate() + 1);
                whereCondition.createdAt.lte = end;
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
}
