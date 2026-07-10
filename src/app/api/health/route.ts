/**
 * Health Check Endpoint
 * GET /api/health - 用于 PM2 和负载均衡器健康检查
 * 检查：进程存活 + 数据库连通 + AI 服务状态 + OSS + 官网 API
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAIEnabled } from "@/lib/ai";

export const dynamic = "force-dynamic";

async function checkHttp(url: string, timeoutMs = 3000): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        return res.ok ? "ok" : `http_${res.status}`;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return msg.includes("abort") ? "timeout" : `unreachable`;
    } finally {
        clearTimeout(timeout);
    }
}

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

    // 3. OSS 连通性（仅已配置时检查）
    if (process.env.ALI_OSS_REGION && process.env.ALI_OSS_BUCKET) {
        const ossHost = process.env.ALI_OSS_PUBLIC_DOMAIN
            || `https://${process.env.ALI_OSS_BUCKET}.${process.env.ALI_OSS_REGION}.aliyuncs.com`;
        checks.oss = await checkHttp(ossHost, 3000);
    }

    // 4. 官网 API 可达性（仅已配置时检查）
    const officialUrl = process.env.OFFICIAL_API_URL;
    if (officialUrl) {
        checks.official_api = await checkHttp(`${officialUrl}/api/health`, 3000);
    }

    const healthy = Object.values(checks).every(v => v === "ok" || v === "disabled");

    return NextResponse.json(
        { status: healthy ? "healthy" : "degraded", checks },
        { status: healthy ? 200 : 503 }
    );
}
