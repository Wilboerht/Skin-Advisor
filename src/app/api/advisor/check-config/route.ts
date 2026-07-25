import { NextRequest, NextResponse } from "next/server";
import { getAISettings } from "@/lib/ai";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { aiQueue, visionQueue, analysisQueue, type QueueStats } from "@/lib/ai-queue";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    // 增加速率限制，防止被用于环境探测
    const ip = getClientIP(request);
    const limit = await rateLimit(`check-config-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limit.success) {
        return NextResponse.json(
            { error: "请求过于频繁" },
            { status: 429 }
        );
    }

    try {
        const settings = await getAISettings();
        const provider = settings.provider;
        const keys = settings.apiKeys || {};
        const key = keys[provider];

        if (!key) {
            return NextResponse.json({
                configured: false,
                message: "AI 服务尚未配置，请先设置 API 密钥后再进行测试。",
            });
        }

        // 收集排队状态（纯内存读取，零 DB 开销）
        const generalStats = aiQueue.getStats();
        const visionStats = visionQueue.getStats();
        const analysisStats = analysisQueue.getStats();

        const isBusy = generalStats.isBusy || visionStats.isBusy || analysisStats.isBusy;
        const totalQueued = generalStats.queueLength + visionStats.queueLength + analysisStats.queueLength;
        const maxWaitSeconds = Math.max(
            generalStats.estimatedWaitSeconds,
            visionStats.estimatedWaitSeconds,
            analysisStats.estimatedWaitSeconds
        );

        return NextResponse.json({
            configured: true,
            queues: { general: generalStats, vision: visionStats, analysis: analysisStats },
            isBusy,
            totalQueued,
            estimatedWaitSeconds: maxWaitSeconds,
        });
    } catch {
        return NextResponse.json({
            configured: false,
            message: "无法获取 AI 配置，请稍后重试。",
        });
    }
}
