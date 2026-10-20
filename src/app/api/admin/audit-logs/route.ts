
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { parseBeijingDate } from "@/lib/time";

// 筛选器缓存 (5min TTL，actions/resources 几乎不变)
let cachedFilters: { actions: string[]; resources: string[] } | null = null;
let cacheTimestamp = 0;
const FILTERS_CACHE_TTL = 5 * 60 * 1000;

// 审计详情中可能包含的 PII 字段。普通 admin 只保留操作上下文，
// 防止通过审计详情绕过用户列表的 email/phone 脱敏策略。
const SENSITIVE_DETAIL_KEYS = new Set([
    "email", "name", "username", "phone", "phonenumber", "mobile",
    "ip", "ipaddress", "useragent", "password", "token", "accesstoken",
    "refreshtoken", "secret", "openid", "unionid", "address", "recipient",
]);

function sanitizeAuditDetails(value: unknown, depth = 0): unknown {
    if (depth > 8) return "***";
    if (Array.isArray(value)) return value.map((item) => sanitizeAuditDetails(item, depth + 1));
    if (value && typeof value === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            result[key] = SENSITIVE_DETAIL_KEYS.has(key.toLowerCase())
                ? (item == null ? null : "***")
                : sanitizeAuditDetails(item, depth + 1);
        }
        return result;
    }
    if (typeof value === "string") {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "***";
        if (/^1[3-9]\d{9}$/.test(value)) return "***";
    }
    return value;
}

// GET /api/admin/audit-logs - List audit logs with filtering
// Available to super_admin and admin
// 非超管脱敏 ip/userAgent：与导出接口仅超管可用的策略保持一致，
// 避免普通 admin 查看全量日志中的敏感客户端信息
export const GET = withAdminAuth(async (request, { admin }) => {
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

        // Date range filter（与导出接口一致：按北京时间日界解析）
        if (startDate || endDate) {
            whereCondition.createdAt = {};
            if (startDate) {
                const d = parseBeijingDate(startDate);
                if (!d) {
                    return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
                }
                whereCondition.createdAt.gte = d;
            }
            if (endDate) {
                const d = parseBeijingDate(endDate);
                if (!d) {
                    return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
                }
                // 包含结束日全天（北京时间次日零点）
                whereCondition.createdAt.lte = new Date(d.getTime() + 24 * 60 * 60 * 1000);
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

        // Get unique actions and resources for filter dropdowns (cached 5min)
        if (!cachedFilters || Date.now() - cacheTimestamp > FILTERS_CACHE_TTL) {
            const [actionsResult, resourcesResult] = await Promise.all([
                prisma.adminAuditLog.findMany({ distinct: ['action'], select: { action: true } }),
                prisma.adminAuditLog.findMany({ distinct: ['resource'], select: { resource: true } }),
            ]);
            cachedFilters = {
                actions: actionsResult.map(a => a.action),
                resources: resourcesResult.map(r => r.resource),
            };
            cacheTimestamp = Date.now();
        }

        // 非超管：脱敏 ip/userAgent 与 details 内的 PII，保留操作审计能力
        const isSuperAdmin = admin.role === "super_admin";
        const data = isSuperAdmin
            ? logs
            : logs.map(log => ({
                ...log,
                ip: log.ip ? "***" : null,
                userAgent: log.userAgent ? "***" : null,
                details: sanitizeAuditDetails(log.details),
            }));

        return NextResponse.json({
            success: true,
            data,
            filters: {
                // 管理员筛选列表仅超管可见（与 /api/admin/admins 的 super_admin 限制一致）
                admins: isSuperAdmin ? admins : [],
                ...cachedFilters!,
            },
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        logger.error("Failed to fetch audit logs:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
});
