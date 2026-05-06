import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, logAdminAction, getClientInfo } from "@/lib/admin-auth";
import bcrypt from "bcryptjs";

const VALID_ROLES = ["super_admin", "admin", "editor"];

// GET /api/admin/admins - List all admins
export const GET = requireRole("super_admin")(async (request) => {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";

        const where = search
            ? {
                OR: [
                    { username: { contains: search, mode: "insensitive" as const } },
                    { email: { contains: search, mode: "insensitive" as const } },
                    { name: { contains: search, mode: "insensitive" as const } },
                ],
            }
            : {};

        const admins = await prisma.adminUser.findMany({
            where,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({ success: true, admins });
    } catch (error) {
        console.error("Admin list error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch admins" },
            { status: 500 }
        );
    }
});

// POST /api/admin/admins - Create a new admin
export const POST = requireRole("super_admin")(async (request, { admin }) => {
    try {
        const body = await request.json();
        const { username, email, password, name, role } = body;

        // Validation
        if (!username || typeof username !== "string" || username.length < 3 || username.length > 50) {
            return NextResponse.json(
                { success: false, error: "用户名必须为3-50个字符" },
                { status: 400 }
            );
        }

        if (!password || typeof password !== "string" || password.length < 6) {
            return NextResponse.json(
                { success: false, error: "密码至少6个字符" },
                { status: 400 }
            );
        }

        if (!role || !VALID_ROLES.includes(role)) {
            return NextResponse.json(
                { success: false, error: "无效的角色" },
                { status: 400 }
            );
        }

        if (email && (typeof email !== "string" || !email.includes("@"))) {
            return NextResponse.json(
                { success: false, error: "无效的邮箱格式" },
                { status: 400 }
            );
        }

        // Check uniqueness
        const existing = await prisma.adminUser.findFirst({
            where: {
                OR: [{ username }, ...(email ? [{ email }] : [])],
            },
        });

        if (existing) {
            return NextResponse.json(
                { success: false, error: "用户名或邮箱已存在" },
                { status: 409 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const newAdmin = await prisma.adminUser.create({
            data: {
                username,
                email: email || null,
                password: hashedPassword,
                name: name || null,
                role,
            },
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        // Log audit
        const clientInfo = getClientInfo(request);
        await logAdminAction({
            adminId: admin.adminId,
            action: "create",
            resource: "AdminUser",
            resourceId: newAdmin.id,
            details: { username, email, name, role },
            ...clientInfo,
        });

        return NextResponse.json({ success: true, admin: newAdmin });
    } catch (error) {
        console.error("Admin create error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to create admin" },
            { status: 500 }
        );
    }
});
