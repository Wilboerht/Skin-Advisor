import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, getClientInfo, logAdminAction } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

// GET /api/admin/export?type=products|users|sessions
// Restricted to super_admin and admin (editor cannot export sensitive data)
// PII exports (users, sessions) restricted to super_admin only
export const GET = requireRole("super_admin", "admin")(async (request, { admin }) => {
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-export-${ip}`, "default", { maxRequests: 10, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const type = request.nextUrl.searchParams.get("type") || "products";

    // PII exports require super_admin
    if ((type === "users" || type === "sessions") && admin.role !== "super_admin") {
        return NextResponse.json({ error: "Forbidden - super_admin required for PII export" }, { status: 403 });
    }

    try {
        let data: unknown[][] = [];
        let filename = "";
        let headers: string[] = [];

        switch (type) {
            case "products":
                const products = await prisma.product.findMany({
                    orderBy: { sortOrder: "asc" },
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

            default:
                return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
        }

        // Convert to CSV
        const escapeCSV = (val: unknown) => {
            let str = String(val ?? "");
            const DANGEROUS_PREFIXES = /^[=+\-\@\t\r]/;
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
        console.error("Admin export error:", error);
        return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
});
