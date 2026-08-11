import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import prisma from "@/lib/prisma";
import { containsInsensitive } from "@/lib/prisma-search";
import { requireRole, logAdminAction, getClientInfo } from "@/lib/admin-auth";
import { AdminRole, VALID_ADMIN_ROLES } from "@/lib/permissions";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import bcrypt from "bcryptjs";
import { logger } from "@/lib/logger";

// GET /api/admin/admins - List all admins
export const GET = requireRole(AdminRole.SUPER_ADMIN)(async (request) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-admins-get-${ip}`, "default", { maxRequests: 60, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return apiError(ErrorCode.RATE_LIMITED, "Too many requests", 429);
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
        logger.error("Admin list error:", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "Failed to fetch admins", 500);
    }
});

// POST /api/admin/admins - Create a new admin
export const POST = requireRole(AdminRole.SUPER_ADMIN)(async (request, { admin }) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-admins-create-${ip}`, "default", { maxRequests: 20, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return apiError(ErrorCode.RATE_LIMITED, "Too many requests", 429);
    }

    try {
        const body = await request.json();
        const { username, email, password, name, role } = body;

        // Normalize username to lowercase
        const normalizedUsername = typeof username === 'string' ? username.toLowerCase().trim() : '';

        // Validation
        if (!normalizedUsername || normalizedUsername.length < 3 || normalizedUsername.length > 50) {
            return apiError(ErrorCode.VALIDATION_ERROR, "用户名必须为3-50个字符", 400);
        }

        if (!password || typeof password !== "string" || password.length < 8) {
            return apiError(ErrorCode.VALIDATION_ERROR, "密码至少8个字符", 400);
        }

        // 密码复杂度校验：至少包含字母和数字（与C端注册一致）
        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
            return apiError(ErrorCode.VALIDATION_ERROR, "密码需包含字母和数字", 400);
        }

        if (!role || !VALID_ADMIN_ROLES.includes(role)) {
            return apiError(ErrorCode.VALIDATION_ERROR, "无效的角色", 400);
        }

        // Improved email validation
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && (typeof email !== "string" || !EMAIL_REGEX.test(email))) {
            return apiError(ErrorCode.VALIDATION_ERROR, "无效的邮箱格式", 400);
        }

        // Name length validation
        if (name !== undefined && (typeof name !== "string" || name.length > 200)) {
            return apiError(ErrorCode.VALIDATION_ERROR, "名字不能超过200个字符", 400);
        }

        // 事务内原子检查唯一性 + 创建，防止并发竞态
        const hashedPassword = await bcrypt.hash(password, 12);

        let newAdmin;
        try {
            newAdmin = await prisma.$transaction(async (tx) => {
                const existing = await tx.adminUser.findFirst({
                    where: {
                        OR: [{ username: normalizedUsername }, ...(email ? [{ email }] : [])],
                    },
                });
                if (existing) {
                    throw new Error("DUPLICATE");
                }
                return tx.adminUser.create({
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
            });
        } catch (e: unknown) {
            if ((e as Error).message === "DUPLICATE") {
                return apiError(ErrorCode.CONFLICT, "用户名或邮箱已存在", 409);
            }
            throw e;
        }

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

        revalidateTag("admin-stats", "max");
        return NextResponse.json({ success: true, admin: newAdmin });
    } catch (error) {
        logger.error("Admin create error:", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "Failed to create admin", 500);
    }
});
