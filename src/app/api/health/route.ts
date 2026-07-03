/**
 * Health Check Endpoint
 * GET /api/health - 用于 PM2 和负载均衡器健康检查
 * 检查：进程存活 + 数据库连通 + AI 服务状态
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAIEnabled } from "@/lib/ai";

export async function GET() {
    const checks: Record<string, string> = {};

    // 1. 数据库连通性
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = "ok";
    } catch {
        checks.database = "fail";
    }

    // 2. AI 服务状态
    try {
        const aiEnabled = await isAIEnabled();
        checks.ai = aiEnabled ? "ok" : "disabled";
    } catch {
        checks.ai = "error";
    }

    // 整体状态
    const healthy = Object.values(checks).every(v => v === "ok" || v === "disabled");

    return NextResponse.json(
        { status: healthy ? "healthy" : "degraded", checks },
        { status: healthy ? 200 : 503 }
    );
}
