import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession, getClientInfo, logAdminAction } from "@/lib/admin-auth";

// GET /api/admin/export?type=products|users|sessions
export async function GET(request: NextRequest) {
    const session = await verifyAdminSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const type = request.nextUrl.searchParams.get("type") || "products";

    let data: any[] = [];
    let filename = "";
    let headers: string[] = [];

    switch (type) {
        case "products":
            const products = await prisma.product.findMany({
                orderBy: { sortOrder: "asc" },
                take: 5000, // Hard limit to prevent memory exhaustion
            });
            headers = ["ID", "Name", "Name (EN)", "Category", "Price", "Stock", "Active", "Featured", "Created"];
            data = products.map((p) => [
                p.id,
                p.name,
                p.nameEn || "",
                p.category,
                p.price,
                p.stock,
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
    const escapeCSV = (val: any) => {
        const str = String(val ?? "");
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
        adminId: session.adminId,
        action: "export",
        resource: type.charAt(0).toUpperCase() + type.slice(1),
        details: { count: data.length },
        ...clientInfo,
    });

    // Return CSV file
    return new NextResponse(csvContent, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    });
}
