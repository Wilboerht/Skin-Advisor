import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { containsInsensitive } from "@/lib/prisma-search";
import { requireRole, logAdminAction, getClientInfo } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import bcrypt from "bcryptjs";

const VALID_ROLES = ["super_admin", "admin"];

// GET /api/admin/admins - List all admins
export const GET = requireRole("super_admin")(async (request) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-admins-get-${ip}`, "default", { maxRequests: 60, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
        const skip = (page - 1) * limit;

        const where = search
            ? {
                OR: [
                    { username: containsInsensitive(search) },
                    { email: containsInsensitive(search) },
                    { name: containsInsensitive(search) },
                ],
            }
            : {};

        const [admins, total] = await Promise.all([
            prisma.adminUser.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    username: true,
                    email: true,
                    name: true,
                    role: true,
                    active: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            prisma.adminUser.count({ where }),
        ]);

        return NextResponse.json({
            success: true,
            admins,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
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
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-admins-create-${ip}`, "default", { maxRequests: 20, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { username, email, password, name, role } = body;

        // Normalize username to lowercase
        const normalizedUsername = typeof username === 'string' ? username.toLowerCase().trim() : '';

        // Validation
        if (!normalizedUsername || normalizedUsername.length < 3 || normalizedUsername.length > 50) {
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

        // Improved email validation
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && (typeof email !== "string" || !EMAIL_REGEX.test(email))) {
            return NextResponse.json(
                { success: false, error: "无效的邮箱格式" },
                { status: 400 }
            );
        }

        // Name length validation
        if (name !== undefined && (typeof name !== "string" || name.length > 200)) {
            return NextResponse.json(
                { success: false, error: "名字不能超过200个字符" },
                { status: 400 }
            );
        }

        // Check uniqueness
        const existing = await prisma.adminUser.findFirst({
            where: {
                OR: [{ username: normalizedUsername }, ...(email ? [{ email }] : [])],
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
                username: normalizedUsername,
                email: email || null,
                password: hashedPassword,
                name: name || null,
                role,
                active: true,
            },
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                role: true,
                active: true,
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
