import { NextRequest, NextResponse } from "next/server";
import { isAIEnabled } from "@/lib/ai";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { aiQueue, visionQueue, analysisQueue } from "@/lib/ai-queue";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    // 增加速率限制，防止被用于环境探测
    const ip = getClientIP(request);
    const limit = await rateLimit(`check-config-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limit.success) {
        return NextResponse.json(
            { error: "操作太快了，请稍等片刻再试。" },
            { status: 429 }
        );
    }

    try {
        const aiEnabled = await isAIEnabled();

        if (!aiEnabled) {
            return NextResponse.json({
                configured: false,
                message: "AI 肌肤检测服务正在准备中，请稍后再来体验。",
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
            message: "AI 肌肤检测服务正在准备中，请稍后再来体验。",
        });
    }
}
