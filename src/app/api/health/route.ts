/**
 * Health Check Endpoint
 * GET /api/health - 用于 PM2 和负载均衡器健康检查
 * 检查：进程存活 + 数据库连通 + AI 服务状态 + OSS + 官网 API
 */
import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { isAIEnabled } from "@/lib/ai";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

async function checkHttp(
    url: string,
    timeoutMs = 3000,
    options: { authReachable?: boolean } = {}
): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        // 私有 OSS bucket 根路径返回 401/403 说明网络可达，不应判为 degraded
        if (res.ok || (options.authReachable && (res.status === 401 || res.status === 403))) {
            return "ok";
        }
        return `http_${res.status}`;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return msg.includes("abort") ? "timeout" : `unreachable`;
    } finally {
        clearTimeout(timeout);
    }
}

export async function GET(req: NextRequest) {
    const ip = getClientIP(req);
    const limit = await rateLimit(`health-ip-${ip}`, "default", { maxRequests: 60, windowMs: 60 * 1000 });
    if (!limit.success) {
        return NextResponse.json({ status: "degraded", error: "rate limited" }, { status: 429 });
    }

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
        const [textEnabled, visionEnabled] = await Promise.all([
            isAIEnabled("text"),
            isAIEnabled("vision"),
        ]);
        checks.ai = textEnabled && visionEnabled ? "ok" : textEnabled || visionEnabled ? "degraded" : "disabled";
    } catch {
        checks.ai = "error";
    }

    // 3. OSS 连通性（仅已配置时检查）
    if (process.env.ALI_OSS_REGION && process.env.ALI_OSS_BUCKET) {
        const ossHost = process.env.ALI_OSS_PUBLIC_DOMAIN
            || `https://${process.env.ALI_OSS_BUCKET}.${process.env.ALI_OSS_REGION}.aliyuncs.com`;
        checks.oss = await checkHttp(ossHost, 3000, { authReachable: true });
    }

    // 4. 官网 API 可达性（仅已配置时检查）
    const officialUrl = process.env.OFFICIAL_API_URL;
    if (officialUrl) {
        // 主站经 Cloudflare 回源偶尔 >3s；3s 会造成 health 误报 degraded。
        checks.official_api = await checkHttp(`${officialUrl}/api/health`, 5000);
    }

    const healthy = Object.values(checks).every(v => v === "ok" || v === "disabled");

    return NextResponse.json(
        { status: healthy ? "healthy" : "degraded", checks },
        { status: healthy ? 200 : 503 }
    );
}
