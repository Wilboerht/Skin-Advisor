import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

// GET /api/public/test-count - 累计完成测肤人数（公开，用于首页社会证明）
export async function GET(request: NextRequest) {
    try {
        const ip = getClientIP(request);
        const ipLimit = await rateLimit(`test-count-ip-${ip}`, "default", { maxRequests: 60, windowMs: 60 * 1000 });
        if (!ipLimit.success) {
            return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
        }

        const count = await prisma.advisorSession.count({
            where: { completedAt: { not: null } }
        });

        // 变化缓慢的数据：CDN/浏览器可缓存 10 分钟
        return NextResponse.json(
            { success: true, count },
            { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" } }
        );
    } catch (error) {
        logger.error("Failed to fetch test count:", error);
        return NextResponse.json({ error: "Failed to fetch test count" }, { status: 500 });
    }
}
