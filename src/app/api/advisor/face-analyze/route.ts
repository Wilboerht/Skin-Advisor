import { NextRequest, NextResponse } from "next/server";

import { analyzeImages, type VisionImage } from "@/lib/ai-vision";
import { isAIEnabled } from "@/lib/ai";
import { FaceAnalyzeRequestSchema } from "@/lib/schemas";
import {
    VISION_ANALYSIS_SYSTEM_PROMPT,
    VISION_ANALYSIS_USER_PROMPT,
    CLAUDE_VISION_PROMPT,
    QWEN_VISION_PROMPT,
} from "@/config/ai-prompts";
import { rateLimit } from "@/lib/ratelimit";
import { aiLogger } from "@/lib/logger";
import { getDefaultFaceAnalysisResult } from "@/lib/advisor-utils";
import { visionQueue } from "@/lib/ai-queue";

export const maxDuration = 60; // 防止超时

export async function POST(request: NextRequest) {
    try {
        // 0. 检查 AI 开关
        if (!(await isAIEnabled())) {
            // if (process.env.NODE_ENV === 'development' || process.env.ALLOW_FALLBACK !== 'false') {
            //     aiLogger.warn("AI disabled, using fallback result for face analysis.");
            //     // 模拟延迟
            //     await new Promise(resolve => setTimeout(resolve, 1500));
            //     return NextResponse.json(getDefaultFaceAnalysisResult());
            // }

            return NextResponse.json(
                { error: "AI 助手当前已暂停服务" },
                { status: 503 }
            );
        }

        // 1. 速率限制
        const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
        const limit = await rateLimit(`face-analyze-${ip}`, "face-analyze"); // 1小时5次

        const rateLimitHeaders = {
            "X-RateLimit-Limit": String(limit.limit),
            "X-RateLimit-Remaining": String(limit.remaining),
            "X-RateLimit-Reset": String(limit.reset)
        };

        if (!limit.success) {
            return NextResponse.json(
                { error: "请求过于频繁，请稍后再试" },
                { status: 429, headers: rateLimitHeaders }
            );
        }

        // 2. 解析与验证
        const body = await request.json();
        const result = FaceAnalyzeRequestSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "无效的请求数据", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const { images, image } = result.data;
        const validImages: VisionImage[] = [];

        // 收集所有有效图片
        if (Array.isArray(images)) {
            // 新版数组格式
            images.forEach((img: any) => {
                if (img.data) {
                    validImages.push({
                        angle: img.angle || "front",
                        data: img.data
                    });
                }
            });
        } else if (images) {
            // 旧版对象格式
            const imgs = images as any; // Cast for TS safety on legacy shape
            if (imgs.front) validImages.push({ angle: "正脸", data: imgs.front });
            if (imgs.left) validImages.push({ angle: "左侧脸", data: imgs.left });
            if (imgs.right) validImages.push({ angle: "右侧脸", data: imgs.right });
            if (imgs.chin) validImages.push({ angle: "下巴/颈部", data: imgs.chin });
        } else if (image) {
            // 旧版单图 string
            validImages.push({ angle: "正脸", data: image });
        }

        if (validImages.length === 0) {
            return NextResponse.json({ error: "无有效图片数据" }, { status: 400 });
        }

        aiLogger.info(`Starting face analysis for IP ${ip} with ${validImages.length} images`);

        // 3. 准备提示词与 Provider
        const provider = process.env.AI_VISION_PROVIDER || "openai";
        let systemPrompt = VISION_ANALYSIS_SYSTEM_PROMPT;

        if (provider === "anthropic") {
            if (typeof CLAUDE_VISION_PROMPT !== 'undefined') {
                systemPrompt = CLAUDE_VISION_PROMPT;
            }
        } else if (provider === "qwen") {
            systemPrompt = QWEN_VISION_PROMPT;
        }

        let acquired = false;
        try {
            // P3: 请求队列处理 - 申请令牌
            // 这是一个异步操作，如果队列已满会等待，直到超时
            aiLogger.debug(`[Queue] Requesting lock. Stats:`, visionQueue.getStats() as any);
            await visionQueue.acquire();
            acquired = true;
            aiLogger.debug(`[Queue] Lock acquired.`);

            // 4. 调用 AI 分析 (包含重试机制)
            const analysisResult = await analyzeImages(
                validImages,
                systemPrompt,
                VISION_ANALYSIS_USER_PROMPT,
                provider as any
            );

            // 5. 结果校验
            if (analysisResult.validation && analysisResult.validation.isValid === false) {
                aiLogger.warn(`Face validation failed: ${analysisResult.validation.message}`);
                return NextResponse.json(
                    {
                        error: "图片验证失败",
                        message: analysisResult.validation.message || "未检测到清晰人脸，请重新拍摄",
                        code: "VALIDATION_FAILED"
                    },
                    { status: 400 }
                );
            }

            return NextResponse.json(analysisResult, {
                headers: {
                    ...rateLimitHeaders,
                    "X-Queue-Position": String(visionQueue.getStats().queueLength),
                    "X-Queue-Wait-Seconds": String(visionQueue.getStats().estimatedWaitSeconds)
                }
            });

        } catch (aiError: any) {
            aiLogger.error("AI Analysis Failed", aiError);

            // 队列超时特有错误
            if (aiError.message?.includes("Queue timeout") || aiError.message?.includes("Server busy")) {
                return NextResponse.json(
                    { error: "服务器繁忙，请稍后再试", code: "SERVER_BUSY" },
                    { status: 503, headers: { "Retry-After": "30" } }
                );
            }

            // Fallback removed to ensure only real data is used
            // if (process.env.NODE_ENV === 'development' || process.env.ALLOW_FALLBACK === 'true') {
            //     aiLogger.warn("Using fallback result due to AI error");
            //     return NextResponse.json(getDefaultFaceAnalysisResult());
            // }

            return NextResponse.json(
                { error: "AI 分析服务暂时不可用，请稍后重试" },
                { status: 503 }
            );
        } finally {
            // P3: 释放令牌
            if (acquired) {
                visionQueue.release();
                aiLogger.debug(`[Queue] Lock released. Stats:`, visionQueue.getStats() as any);
            }
        }

    } catch (error) {
        console.error("Critical error in face analysis:", error);
        return NextResponse.json(
            { error: "服务器内部错误" },
            { status: 500 }
        );
    }
}
