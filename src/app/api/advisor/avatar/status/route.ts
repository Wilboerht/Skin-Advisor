import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { processAvatarQueueItem } from "@/lib/avatar-queue-processor";
import { withDbRetry } from "@/lib/utils";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const ip = getClientIP(req);
        const limitResult = await rateLimit(`avatar-status-${ip}`, "default", { maxRequests: 120, windowMs: 60 * 1000 });
        if (!limitResult.success) {
            return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
        }

        const sessionId = req.nextUrl.searchParams.get("sessionId");

        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        // 首先检查队列状态
        const queueItem = await withDbRetry(() =>
            prisma.avatarQueue.findUnique({
                where: { sessionId }
            })
        );

        if (queueItem) {
            // 处理卡死的 processing 任务（Serverless 环境下 Lambda 可能被回收）
            if (queueItem.status === "processing") {
                const processingTimeoutMs = 5 * 60 * 1000; // 5 分钟超时
                const startedAt = queueItem.startedAt ? new Date(queueItem.startedAt).getTime() : 0;
                // startedAt 为 null 也视为超时（on-demand processing 可能未设置）
                if (!queueItem.startedAt || Date.now() - startedAt > processingTimeoutMs) {
                    console.warn(`[AvatarQueue] Processing timeout for ${sessionId}, resetting to pending`);
                    try {
                        await prisma.avatarQueue.updateMany({
                            where: { id: queueItem.id, status: "processing" },
                            data: { status: "pending", errorMessage: "Processing timeout, will retry" }
                        });
                        // 重新读取更新后的队列项
                        const refreshed = await prisma.avatarQueue.findUnique({ where: { sessionId } });
                        if (refreshed) {
                            Object.assign(queueItem, refreshed);
                        }
                    } catch (e) {
                        console.error(`[AvatarQueue] Failed to reset processing timeout:`, e);
                    }
                }
            }

            // 如果已完成，返回生成的头像
            if (queueItem.status === "completed" && queueItem.generatedUrl) {
                return NextResponse.json({
                    generatedAvatar: queueItem.generatedUrl,
                    isReady: true,
                    source: queueItem.source,
                    queueStatus: "completed"
                });
            }

            // 如果是 pending，尝试用乐观锁抢处理权（on-demand 处理，无独立后台 worker）
            if (queueItem.status === "pending") {
                try {
                    // 乐观锁：只有 status 还是 pending 时才更新为 processing
                    const updated = await prisma.avatarQueue.updateMany({
                        where: { id: queueItem.id, status: "pending" },
                        data: { status: "processing", startedAt: new Date() }
                    });

                    if (updated.count > 0) {
                        // 重新确认状态，确保本次乐观锁成功抢到处理权
                        const refreshed = await prisma.avatarQueue.findUnique({
                            where: { sessionId }
                        });
                        if (refreshed?.status === "processing") {
                            // 异步处理，不阻塞响应；使用原对象触发处理器
                            processAvatarQueueItem(queueItem).catch(err => {
                                console.error(`[AvatarQueue] On-demand processing failed for ${sessionId}:`, err);
                            });
                        }
                    }
                } catch (e) {
                    console.warn("[AvatarQueue] Failed to trigger on-demand processing:", e);
                }
            }

            // 计算队列位置
            const position = await withDbRetry(() =>
                prisma.avatarQueue.count({
                    where: {
                        status: "pending",
                        createdAt: { lt: queueItem.createdAt }
                    }
                })
            );

            // 如果正在处理或等待中
            const estimatedWaitTime = Math.max(10, position * 8); // 每个队列项约 8 秒
            return NextResponse.json({
                generatedAvatar: null,
                isReady: false,
                queueStatus: queueItem.status === "pending" ? "processing" : queueItem.status,
                queuePosition: position + 1,
                estimatedWaitTime,
                message: queueItem.status === "processing"
                    ? "正在生成..."
                    : `排队中，位置 #${position + 1}，预计 ${estimatedWaitTime}秒`
            });
        }

        // 如果没有队列项，检查 AdvisorSession 中是否已经有头像
        const session = await withDbRetry(() =>
            prisma.advisorSession.findUnique({
                where: { sessionId },
                select: { analysisResult: true }
            })
        );

        if (!session || !session.analysisResult) {

            return NextResponse.json({ 
                generatedAvatar: null,
                isReady: false,
                queueStatus: "not_found"
            });
        }

        const result = session.analysisResult as any;
        const generatedAvatar = result.generatedAvatar || null;


        return NextResponse.json({
            generatedAvatar,
            isReady: !!generatedAvatar,
            queueStatus: "completed"
        });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error("Failed to fetch avatar status:", error);
        return NextResponse.json({
            error: "获取头像状态失败，请稍后重试"
        }, { status: 500 });
    }
}
