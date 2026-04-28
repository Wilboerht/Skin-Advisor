import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { processAvatarQueueItem } from "@/lib/avatar-queue-processor";
import { withDbRetry } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
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


            // 如果已完成，返回生成的头像
            if (queueItem.status === "completed" && queueItem.generatedUrl) {
                return NextResponse.json({
                    generatedAvatar: queueItem.generatedUrl,
                    isReady: true,
                    source: queueItem.source,
                    queueStatus: "completed"
                });
            }

            // 如果是 pending，尝试用乐观锁抢处理权（解决 Vercel 无后台 worker 问题）
            if (queueItem.status === "pending") {
                try {
                    // 乐观锁：只有 status 还是 pending 时才更新为 processing
                    const updated = await prisma.avatarQueue.updateMany({
                        where: { id: queueItem.id, status: "pending" },
                        data: { status: "processing" }
                    });

                    if (updated.count > 0) {
                        console.log(`[AvatarQueue] On-demand processing triggered for ${sessionId}`);
                        // 异步处理，不阻塞响应
                        processAvatarQueueItem(queueItem).catch(err => {
                            console.error(`[AvatarQueue] On-demand processing failed for ${sessionId}:`, err);
                        });
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

    } catch (error: any) {
        console.error("Failed to fetch avatar status:", error);
        return NextResponse.json({
            error: "Failed to fetch avatar status",
            details: error.message
        }, { status: 500 });
    }
}
