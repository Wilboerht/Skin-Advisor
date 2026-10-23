import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { getAdvisorDashboardStats } from "@/lib/admin-dashboard-stats";
import { logger } from "@/lib/logger";

// GET /api/admin/stats - Dashboard statistics
// Available to super_admin and admin
export const GET = withAdminAuth(async (request: NextRequest) => {
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-stats-${ip}`, "default", {
        maxRequests: 60,
        windowMs: 60 * 1000,
    });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const data = await getAdvisorDashboardStats();
        return NextResponse.json({ success: true, data });
    } catch (error) {
        logger.error("Failed to fetch stats:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
});
