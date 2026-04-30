/**
 * 头像生成 API - 改为加入队列模式
 * 
 * 不再立即生成，而是加入队列由后台 Worker 处理
 * 这规避了火山引擎的 1-2 并发限制问题
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { processAvatarQueueItem } from "@/lib/avatar-queue-processor";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sessionId, characteristics, nickname, frontPhoto } = body;

        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        console.log(`📝 Enqueuing avatar generation for session ${sessionId}...`);

        // 使用 upsert 实现幂等：并发请求下不会重复创建记录
        // sessionId 已加 @unique 约束，upsert 在数据库层面是原子的
        const queueItem = await prisma.avatarQueue.upsert({
            where: { sessionId },
            update: {}, // 已存在则不修改任何字段
            create: {
                sessionId,
                status: "pending",
                nickname,
                characteristics,
                frontPhoto,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
                attempts: 0
            }
        });

        const isExisting = queueItem.status !== "pending" || queueItem.generatedUrl;
        if (isExisting) {
            console.log(`ℹ️  Avatar queue entry already exists for ${sessionId} (status: ${queueItem.status})`);
        }

        // 计算队列位置
        const position = await prisma.avatarQueue.count({
            where: {
                status: "pending",
                createdAt: { lt: queueItem.createdAt }
            }
        });

        if (isExisting) {
            return NextResponse.json({
                success: true,
                queued: true,
                queueId: queueItem.id,
                position: position + 1,
                status: queueItem.status,
                generatedUrl: queueItem.generatedUrl,
                message: `已在队列中，位置: #${position + 1}`
            });
        }

        console.log(`✅ Enqueued avatar generation (queueId: ${queueItem.id}, position: #${position + 1})`);

        // 立即触发异步处理（fire-and-forget），无需等待 status 轮询才 kickoff
        // 生产环境有后台 worker，乐观锁会防止重复处理；开发环境依赖此机制
        processAvatarQueueItem(queueItem).catch(err => {
            console.error(`[AvatarQueue] Immediate processing failed for ${sessionId}:`, err);
        });

        return NextResponse.json({
            success: true,
            queued: true,
            queueId: queueItem.id,
            position: position + 1,
            status: "pending",
            message: `头像正在生成队列中，位置: #${position + 1}，预计等待 ${Math.max(10, position * 8)}秒`
        });

    } catch (error: any) {
        console.error("Avatar queue error:", error);
        return NextResponse.json(
            { error: "Failed to enqueue avatar generation", details: error.message },
            { status: 500 }
        );
    }
}
