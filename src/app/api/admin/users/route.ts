import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

// GET /api/admin/users - List users with pagination and search
export async function GET(request: NextRequest) {
    const session = await verifyAdminSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all"; // all, active, inactive

    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
        where.OR = [
            { email: { contains: search } },
            { name: { contains: search } },
        ];
    }

    if (status === "active") {
        where.role = "user";
    } else if (status === "inactive") {
        where.role = "disabled";
    } else if (status === "vip") {
        where.role = "vip";
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
}
