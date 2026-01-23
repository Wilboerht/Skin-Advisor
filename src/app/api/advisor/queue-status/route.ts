import { NextResponse } from "next/server";
import { chatQueue, visionQueue } from "@/lib/ai-queue";

export async function GET() {
    // 获取真实队列状态
    const chatStats = chatQueue.getStats();
    const visionStats = visionQueue.getStats();

    // 综合判断繁忙程度
    const inQueue = chatStats.queueLength > 0 || visionStats.queueLength > 0;
    const maxQueue = Math.max(chatStats.queueLength, visionStats.queueLength);
    const maxWait = Math.max(chatStats.estimatedWaitSeconds, visionStats.estimatedWaitSeconds);

    // 生成状态消息
    let message = "系统负载正常";
    if (inQueue) {
        message = `当前排队人数：${maxQueue}人，预计等待 ${maxWait} 秒`;
    } else if (chatStats.isBusy || visionStats.isBusy) {
        message = "AI系统正在处理请求";
    }

    return NextResponse.json({
        inQueue,
        position: maxQueue > 0 ? maxQueue : 0,
        estimatedWaitSeconds: maxWait,
        message,
        details: {
            chat: chatStats,
            vision: visionStats
        }
    });
}
