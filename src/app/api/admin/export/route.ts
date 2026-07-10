import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, getClientInfo, logAdminAction } from "@/lib/admin-auth";
import { canExportPII, AdminRole } from "@/lib/permissions";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

// GET /api/admin/export?type=products|users|sessions|audit-logs
// Restricted to super_admin and admin
// PII exports (users, sessions, audit-logs) restricted to super_admin only
export const GET = requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)(async (request, { admin }) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-export-${ip}`, "default", { maxRequests: 10, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const type = request.nextUrl.searchParams.get("type") || "products";

    // Sensitive exports (PII) require super_admin
    if ((type === "users" || type === "sessions" || type === "audit-logs") && !canExportPII(admin.role)) {
        return NextResponse.json({ error: "Forbidden - super_admin required for this export" }, { status: 403 });
    }

    try {
        let data: unknown[][] = [];
        let filename = "";
        let headers: string[] = [];

        switch (type) {
            case "products":
                const products = await prisma.product.findMany({
                    orderBy: { createdAt: "desc" },
                    take: 5000, // Hard limit to prevent memory exhaustion
                });
                headers = ["ID", "Name", "Category", "Price", "Active", "Featured", "Created"];
                data = products.map((p) => [
                    p.id,
                    p.name,
                    p.category,
                    p.price,
                    p.active ? "Yes" : "No",
                    p.featured ? "Yes" : "No",
                    new Date(p.createdAt).toISOString(),
                ]);
                filename = `products_export_${new Date().toISOString().split("T")[0]}.csv`;
                break;

            case "users":
                const users = await prisma.user.findMany({
                    include: {
                        _count: { select: { advisorSessions: true } },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 5000, // Hard limit to prevent memory exhaustion
                });
                headers = ["ID", "Email", "Name", "Role", "Tests Taken", "Created"];
                data = users.map((u) => [
                    u.id,
                    u.email,
                    u.name || "",
                    u.role,
                    u._count.advisorSessions,
                    new Date(u.createdAt).toISOString(),
                ]);
                filename = `users_export_${new Date().toISOString().split("T")[0]}.csv`;
                break;

            case "sessions":
                const sessions = await prisma.advisorSession.findMany({
                    orderBy: { createdAt: "desc" },
                    take: 1000, // Limit to last 1000
                    include: {
                        user: { select: { email: true, name: true } },
                    },
                });
                headers = ["ID", "User Email", "User Name", "Province", "Device", "Started", "Completed", "Shared"];
                data = sessions.map((s) => [
                    s.id,
                    s.user?.email || "Guest",
                    s.user?.name || "",
                    s.province || "",
                    s.deviceType || "",
                    s.startedAt ? new Date(s.startedAt).toISOString() : "",
                    s.completedAt ? new Date(s.completedAt).toISOString() : "",
                    s.resultShared ? "Yes" : "No",
                ]);
                filename = `sessions_export_${new Date().toISOString().split("T")[0]}.csv`;
                break;

            case "audit-logs":
                const startDate = request.nextUrl.searchParams.get("startDate") || undefined;
                const endDate = request.nextUrl.searchParams.get("endDate") || undefined;
                const where: { createdAt?: { gte?: Date; lte?: Date } } = {};
                if (startDate) {
                    where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
                }
                if (endDate) {
                    const d = new Date(endDate);
                    d.setDate(d.getDate() + 1);
                    where.createdAt = { ...where.createdAt, lte: d };
                }
                const auditLogs = await prisma.adminAuditLog.findMany({
                    where,
                    orderBy: { createdAt: "desc" },
                    take: 5000,
                    include: {
                        admin: { select: { username: true, name: true } }
                    }
                });
                headers = ["ID", "Admin", "Action", "Resource", "ResourceID", "Details", "IP", "CreatedAt"];
                data = auditLogs.map((log) => [
                    log.id,
                    log.admin?.name || log.admin?.username || "System",
                    log.action,
                    log.resource,
                    log.resourceId || "",
                    JSON.stringify(log.details || {}),
                    log.ip || "",
                    new Date(log.createdAt).toISOString(),
                ]);
                filename = `audit_logs_export_${new Date().toISOString().split("T")[0]}.csv`;
                break;

            default:
                return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
        }

        // Convert to CSV
        const escapeCSV = (val: unknown) => {
            let str = String(val ?? "");
            // Defend against CSV injection: prefix dangerous characters with apostrophe
            const DANGEROUS_PREFIXES = /^[=+\-\@\t\r\|%0]/;
            if (DANGEROUS_PREFIXES.test(str)) {
                str = "'" + str;
            }
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const csvContent = [
            headers.join(","),
            ...data.map((row) => row.map(escapeCSV).join(",")),
        ].join("\n");

        // Log export action
        const clientInfo = getClientInfo(request);
        await logAdminAction({
            adminId: admin.adminId,
            action: "export",
            resource: type.charAt(0).toUpperCase() + type.slice(1),
            details: { count: data.length },
            ...clientInfo,
        });

        // Return CSV file
        return new NextResponse(csvContent, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
            },
        });
    } catch (error) {
        logger.error("Admin export error:", error);
        return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
});
