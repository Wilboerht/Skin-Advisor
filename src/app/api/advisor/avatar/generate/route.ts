/**
 * 头像生成 API - 改为加入队列模式
 * 
 * 不再立即生成，而是加入队列由后台 Worker 处理
 * 这规避了火山引擎的 1-2 并发限制问题
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { processAvatarQueueItem } from "@/lib/avatar-queue-processor";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

const MAX_BASE64_SIZE_MB = 10;

function isValidBase64DataURI(str: string): boolean {
    return typeof str === 'string' && /^data:image\/[a-zA-Z0-9+]+;base64,/.test(str);
}

function estimateBase64SizeMB(base64: string): number {
    // base64 长度 × 3/4 ≈ 原始字节数，再转换为 MB
    const bytes = (base64.length * 3) / 4;
    return bytes / (1024 * 1024);
}

export async function POST(req: NextRequest) {
    try {
        const ip = getClientIP(req);
        const limitResult = await rateLimit(`avatar-generate-${ip}`, "default", { maxRequests: 10, windowMs: 60 * 1000 });
        if (!limitResult.success) {
            return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
        }

        const body = await req.json();
        const { sessionId, characteristics, nickname, frontPhoto } = body;

        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        // P1-25: frontPhoto 验证（支持 base64 data URI 或公网 URL）
        if (frontPhoto) {
            const isBase64 = isValidBase64DataURI(frontPhoto);
            const isUrl = typeof frontPhoto === 'string' && frontPhoto.startsWith('http');

            if (!isBase64 && !isUrl) {
                return NextResponse.json(
                    { error: "frontPhoto must be a valid base64 data URI or a public URL", code: "INVALID_IMAGE_FORMAT" },
                    { status: 400 }
                );
            }

            if (isBase64) {
                const sizeMB = estimateBase64SizeMB(frontPhoto);
                if (sizeMB > MAX_BASE64_SIZE_MB) {
                    return NextResponse.json(
                        { error: `Image too large (${sizeMB.toFixed(1)}MB). Max ${MAX_BASE64_SIZE_MB}MB allowed.`, code: "IMAGE_TOO_LARGE" },
                        { status: 413 }
                    );
                }
            }
        }

        console.log(`📝 Enqueuing avatar generation for session ${sessionId}...`);

        // P1-24: 使用 create + P2002 捕获实现幂等，防止并发重复创建
        let queueItem;
        try {
            queueItem = await prisma.avatarQueue.create({
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
        } catch (e: any) {
            if (e.code === 'P2002') {
                // 记录已存在（并发请求或重复提交），查询当前状态返回
                queueItem = await prisma.avatarQueue.findUnique({
                    where: { sessionId }
                });
                if (!queueItem) {
                    return NextResponse.json({ error: "Queue item not found" }, { status: 500 });
                }

                const position = await prisma.avatarQueue.count({
                    where: {
                        status: "pending",
                        createdAt: { lt: queueItem.createdAt }
                    }
                });

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
            throw e;
        }

        // 计算队列位置
        const position = await prisma.avatarQueue.count({
            where: {
                status: "pending",
                createdAt: { lt: queueItem.createdAt }
            }
        });

        console.log(`✅ Enqueued avatar generation (queueId: ${queueItem.id}, position: #${position + 1})`);

        // 立即触发异步处理（fire-and-forget）
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
