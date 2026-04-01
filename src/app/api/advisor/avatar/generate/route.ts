/**
 * 头像生成 API - 改为加入队列模式
 * 
 * 不再立即生成，而是加入队列由后台 Worker 处理
 * 这规避了火山引擎的 1-2 并发限制问题
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sessionId, characteristics, nickname, frontPhoto } = body;

        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        console.log(`📝 Enqueuing avatar generation for session ${sessionId}...`);

        // 检查是否已有该 sessionId 的队列项
        const existing = await prisma.avatarQueue.findUnique({
            where: { sessionId }
        });

        if (existing) {
            // 已存在，返回现有状态
            console.log(`ℹ️  Avatar queue entry already exists for ${sessionId}`);
            
            // 计算队列位置
            const position = await prisma.avatarQueue.count({
                where: {
                    status: "pending",
                    createdAt: { lt: existing.createdAt }
                }
            });

            return NextResponse.json({
                success: true,
                queued: true,
                queueId: existing.id,
                position: position + 1,
                status: existing.status,
                generatedUrl: existing.generatedUrl,
                message: `已在队列中，位置: #${position + 1}`
            });
        }

        // 创建新的队列项
        const queueItem = await prisma.avatarQueue.create({
            data: {
                sessionId,
                status: "pending",
                nickname,
                characteristics,
                frontPhoto,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
                attempts: 0
            }
        });

        // 计算当前队列位置
        const position = await prisma.avatarQueue.count({
            where: {
                status: "pending",
                createdAt: { lt: queueItem.createdAt }
            }
        });

        console.log(`✅ Enqueued avatar generation (queueId: ${queueItem.id}, position: #${position + 1})`);

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
