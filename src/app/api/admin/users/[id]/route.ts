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
            shareRewards: {
                orderBy: { createdAt: "desc" },
                take: 5,
            },
            _count: {
                select: { advisorSessions: true, shareRewards: true, wishlists: true }
            },
            wishlists: {
                include: {
                    items: {
                        include: {
                            product: true
                        }
                    }
                }
            },
            reminderSettings: true
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
    const { role, name, dailyTestLimit } = body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (name !== undefined) updateData.name = name;
    if (dailyTestLimit !== undefined) updateData.dailyTestLimit = dailyTestLimit;

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
            newDailyTestLimit: dailyTestLimit
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
