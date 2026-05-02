import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession, getClientInfo, logAdminAction } from "@/lib/admin-auth";

// GET /api/admin/users/[id] - Get user details
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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
            }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error("Admin user GET error:", error);
        return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
    }
}

// PATCH /api/admin/users/[id] - Update user (disable/enable, update role, dailyTestLimit)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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

        const updatedUser = await prisma.user.update({
            where: { id },
            data: {
                ...(role !== undefined && { role }),
                ...(name !== undefined && { name }),
                ...(dailyTestLimit !== undefined && { dailyTestLimit: Number(dailyTestLimit) }),
                ...(vipExpiresAt !== undefined && { vipExpiresAt: vipExpiresAt ? new Date(vipExpiresAt) : null }),
            },
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
                previousDailyTestLimit: user.dailyTestLimit,
                newDailyTestLimit: dailyTestLimit,
                previousVipExpiresAt: user.vipExpiresAt,
                newVipExpiresAt: vipExpiresAt
            },
            ...clientInfo,
        });

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error("Admin user PATCH error:", error);
        return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
}

// DELETE /api/admin/users/[id] - Delete user
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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
    } catch (error) {
        console.error("Admin user DELETE error:", error);
        return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
    }
}
