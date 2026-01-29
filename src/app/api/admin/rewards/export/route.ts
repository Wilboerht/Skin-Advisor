
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession, logAdminAction, getClientInfo } from "@/lib/admin-auth";

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

        // Generate CSV content
        const headers = ['Name', 'Phone', 'Address', 'Skin Score', 'Percentile', 'Status', 'Tracking No', 'Created At'];
        const rows = rewards.map(r => [
            r.name,
            r.phone,
            `"${r.address.replace(/"/g, '""')}"`, // Escape quotes in address
            r.skinScore || '',
            r.percentile || '',
            r.status,
            r.trackingNo || '',
            new Date(r.createdAt).toISOString()
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

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

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
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
