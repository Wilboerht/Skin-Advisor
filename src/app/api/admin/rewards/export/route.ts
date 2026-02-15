
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession, logAdminAction, getClientInfo } from "@/lib/admin-auth";

/**
 * Safely escape a CSV field value.
 * - Wraps in quotes if it contains comma, quote, or newline
 * - Doubles internal quotes
 * - Strips leading =, +, -, @ characters to prevent CSV injection in Excel
 */
function escapeCSV(val: any): string {
    let str = String(val ?? "");

    // CSV injection prevention: strip formula-triggering characters at the start
    str = str.replace(/^[=+\-@\t\r]+/, "");

    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export async function GET(request: NextRequest) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const clientInfo = getClientInfo(request);

        const whereCondition = status && status !== 'all' ? { status } : {};

        const rewards = await prisma.shareReward.findMany({
            where: whereCondition,
            orderBy: { createdAt: 'desc' },
        });

        // Generate CSV content — all fields properly escaped
        const headers = ['Name', 'Phone', 'Address', 'Skin Score', 'Percentile', 'Status', 'Tracking No', 'Created At'];
        const rows = rewards.map(r => [
            escapeCSV(r.name),
            escapeCSV(r.phone),
            escapeCSV(r.address),
            escapeCSV(r.skinScore ?? ''),
            escapeCSV(r.percentile ?? ''),
            escapeCSV(r.status),
            escapeCSV(r.trackingNo ?? ''),
            escapeCSV(new Date(r.createdAt).toISOString())
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        // Add BOM for proper UTF-8 display in Excel
        const bom = '\uFEFF';

        // Log export action
        await logAdminAction({
            adminId: admin.adminId,
            action: "export",
            resource: "ShareReward",
            details: {
                count: rewards.length,
                statusFilter: status || "all"
            },
            ...clientInfo
        });

        return new NextResponse(bom + csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="rewards-export-${new Date().toISOString().split('T')[0]}.csv"`,
            },
        });

    } catch (error) {
        console.error("CSV export failed:", error);
        return NextResponse.json(
            { success: false, error: "Export failed" },
            { status: 500 }
        );
    }
}
