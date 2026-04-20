import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const sessionId = req.nextUrl.searchParams.get("sessionId");

        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        // 首先检查队列状态
        const queueItem = await prisma.avatarQueue.findUnique({
            where: { sessionId }
        });

        if (queueItem) {
            console.log("[DEBUG] Avatar status API - queueItem found:", queueItem.sessionId, "status:", queueItem.status, "generatedUrl:", queueItem.generatedUrl ? queueItem.generatedUrl.substring(0, 60) + "..." : "null");
            // 计算队列位置
            const position = await prisma.avatarQueue.count({
                where: {
                    status: "pending",
                    createdAt: { lt: queueItem.createdAt }
                }
            });

            // 如果已完成，返回生成的头像
            if (queueItem.status === "completed" && queueItem.generatedUrl) {
                return NextResponse.json({
                    generatedAvatar: queueItem.generatedUrl,
                    isReady: true,
                    source: queueItem.source,
                    queueStatus: "completed"
                });
            }

            // 如果正在处理或等待中
            const estimatedWaitTime = Math.max(10, position * 8); // 每个队列项约 8 秒
            return NextResponse.json({
                generatedAvatar: null,
                isReady: false,
                queueStatus: queueItem.status,
                queuePosition: position + 1,
                estimatedWaitTime,
                message: queueItem.status === "processing" 
                    ? "正在生成..."
                    : `排队中，位置 #${position + 1}，预计 ${estimatedWaitTime}秒`
            });
        }

        // 如果没有队列项，检查 AdvisorSession 中是否已经有头像
        const session = await prisma.advisorSession.findUnique({
            where: { sessionId },
            select: { analysisResult: true }
        });

        if (!session || !session.analysisResult) {
            console.log("[DEBUG] Avatar status API - no session or analysisResult found for:", sessionId);
            return NextResponse.json({ 
                generatedAvatar: null,
                isReady: false,
                queueStatus: "not_found"
            });
        }

        const result = session.analysisResult as any;
        const generatedAvatar = result.generatedAvatar || null;
        console.log("[DEBUG] Avatar status API - session found, generatedAvatar:", generatedAvatar ? generatedAvatar.substring(0, 60) + "..." : "null");

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
