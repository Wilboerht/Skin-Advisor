import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession, getClientInfo, logAdminAction } from "@/lib/admin-auth";

// GET /api/admin/users/[id] - Get user details
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await verifyAdminSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
        where: { id },
        include: {
            advisorSessions: {
                orderBy: { createdAt: "desc" },
                take: 10,
                select: {
                    id: true,
                    createdAt: true,
                    completedAt: true,
                    analysisSource: true,
                    resultShared: true,
                    shareMethod: true,
                    deviceType: true,
                    province: true,
                }
            },
            _count: {
                select: { advisorSessions: true }
            }
        } as any
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
}

// PATCH /api/admin/users/[id] - Update user (disable/enable, update role, dailyTestLimit)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await verifyAdminSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { role, name, dailyTestLimit, vipExpiresAt } = body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const VALID_ROLES = ["user", "vip", "disabled", "admin", "super_admin"];
    if (role !== undefined && !VALID_ROLES.includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (name !== undefined) updateData.name = name;
    if (dailyTestLimit !== undefined) {
        const limitNum = Number(dailyTestLimit);
        if (Number.isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return NextResponse.json({ error: "dailyTestLimit must be between 1 and 100" }, { status: 400 });
        }
        updateData.dailyTestLimit = limitNum;
    }
    if (vipExpiresAt !== undefined) {
        // Support null (clear expiration = permanent VIP) or ISO date string
        updateData.vipExpiresAt = vipExpiresAt ? new Date(vipExpiresAt) : null;
    }

    const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
    });

    // Log admin action
    const clientInfo = getClientInfo(request);
    await logAdminAction({
        adminId: session.adminId,
        action: "update",
        resource: "User",
        resourceId: id,
        details: {
            previousRole: user.role,
            newRole: role,
            previousDailyTestLimit: (user as any).dailyTestLimit,
            newDailyTestLimit: dailyTestLimit,
            previousVipExpiresAt: user.vipExpiresAt,
            newVipExpiresAt: vipExpiresAt
        },
        ...clientInfo,
    });

    return NextResponse.json(updatedUser);
}

// DELETE /api/admin/users/[id] - Delete user
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await verifyAdminSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.user.delete({ where: { id } });

    // Log admin action
    const clientInfo = getClientInfo(request);
    await logAdminAction({
        adminId: session.adminId,
        action: "delete",
        resource: "User",
        resourceId: id,
        details: { email: user.email, name: user.name },
        ...clientInfo,
    });

    return NextResponse.json({ success: true });
}
