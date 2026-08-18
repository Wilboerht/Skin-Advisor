import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, getClientInfo, logAdminAction } from "@/lib/admin-auth";
import { canExportPII, AdminRole } from "@/lib/permissions";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { parseBeijingDate } from "@/lib/time";
import { extractSessionStats } from "@/lib/session-archive";
import { logger } from "@/lib/logger";

// GET /api/admin/export?type=products|users|sessions|audit-logs|whitepaper
// Restricted to super_admin and admin
// PII exports (users, sessions, audit-logs) restricted to super_admin only
// whitepaper 为脱敏群体统计数据（无身份标识、无敏感问卷字段），admin 可导出
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
        // 截断标注：达到 take 上限时在响应头与文件名中显式标注，避免静默丢数据
        let truncated = false;
        let rowLimit = 0;

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
                rowLimit = 5000;
                truncated = products.length >= rowLimit;
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
                rowLimit = 5000;
                truncated = users.length >= rowLimit;
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
                rowLimit = 1000;
                truncated = sessions.length >= rowLimit;
                break;

            case "whitepaper":
                // 白皮书群体统计：每行一条已完成测肤的脱敏统计字段（热层+冷层通吃）。
                // 不含任何身份标识（userId/邮箱/昵称）与敏感问卷字段（过敏史/孕期/医美等），
                // 地域粒度只到省级，供《NIHPLOD 中国女性白皮书》等群体统计使用。
                const statsSessions = await prisma.advisorSession.findMany({
                    where: { completedAt: { not: null } },
                    orderBy: { completedAt: "asc" },
                    take: 20000, // Hard limit to prevent memory exhaustion
                    select: {
                        completedAt: true,
                        answers: true,
                        analysisResult: true,
                        faceScanUsed: true,
                        faceScanSkipped: true,
                        province: true,
                        shareMethod: true,
                        resultShared: true,
                        archivedAt: true,
                        utmSource: true,
                    },
                });
                headers = [
                    "CompletedAt", "SkinType(AI)", "Persona", "OverallScore",
                    "Wrinkles", "WaterOil", "Spots", "Texture",
                    "AgeRange", "Budget", "SkinType(Self)", "PrimaryConcern",
                    "Province", "ScanMode", "Shared", "ShareChannel", "UTMSource", "DataLayer",
                ];
                data = statsSessions.map((s) => {
                    const st = extractSessionStats(s.analysisResult, s.answers);
                    return [
                        s.completedAt ? new Date(s.completedAt).toISOString() : "",
                        st.skinTypeLabel || "",
                        st.persona || "",
                        st.overallScore ?? "",
                        st.dimensions?.wrinkles ?? "",
                        st.dimensions?.waterOil ?? "",
                        st.dimensions?.spots ?? "",
                        st.dimensions?.texture ?? "",
                        st.ageRange || "",
                        st.budget || "",
                        st.selfSkinType || "",
                        st.primaryConcern || "",
                        s.province || "",
                        s.faceScanUsed ? "face-scan" : s.faceScanSkipped ? "questionnaire-only" : "unknown",
                        s.resultShared ? "Yes" : "No",
                        s.shareMethod || "",
                        s.utmSource || "",
                        s.archivedAt ? "cold" : "hot",
                    ];
                });
                filename = `whitepaper_stats_${new Date().toISOString().split("T")[0]}.csv`;
                rowLimit = 20000;
                truncated = statsSessions.length >= rowLimit;
                break;

            case "audit-logs":
                const startDate = request.nextUrl.searchParams.get("startDate") || undefined;
                const endDate = request.nextUrl.searchParams.get("endDate") || undefined;
                const where: { createdAt?: { gte?: Date; lte?: Date } } = {};
                if (startDate) {
                    // 固定按北京时间零点解析；非法日期返回 400 而非 Invalid Date 导致 500
                    const d = parseBeijingDate(startDate);
                    if (!d) {
                        return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
                    }
                    where.createdAt = { ...where.createdAt, gte: d };
                }
                if (endDate) {
                    const d = parseBeijingDate(endDate);
                    if (!d) {
                        return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
                    }
                    // 包含结束日全天（北京时间次日零点）
                    where.createdAt = { ...where.createdAt, lte: new Date(d.getTime() + 24 * 60 * 60 * 1000) };
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
                rowLimit = 5000;
                truncated = auditLogs.length >= rowLimit;
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
            details: { count: data.length, truncated, rowLimit },
            ...clientInfo,
        });

        // 截断时在文件名插入标注（.csv 前缀之前），并在响应头中携带，便于调用方识别数据不完整
        if (truncated) {
            filename = filename.replace(/\.csv$/i, `_truncated_first_${rowLimit}.csv`);
        }

        // Return CSV file
        return new NextResponse(csvContent, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
                ...(truncated
                    ? {
                        "X-Export-Truncated": "true",
                        "X-Export-Row-Limit": String(rowLimit),
                    }
                    : {}),
            },
        });
    } catch (error) {
        logger.error("Admin export error:", error);
        return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
});
