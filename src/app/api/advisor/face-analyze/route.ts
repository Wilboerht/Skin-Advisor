import { NextRequest, NextResponse } from "next/server";

import { analyzeImages, type VisionImage } from "@/lib/ai-vision";
import { isAIEnabled } from "@/lib/ai";
import { FaceAnalyzeRequestSchema } from "@/lib/schemas";
import {
    VISION_ANALYSIS_SYSTEM_PROMPT,
    VISION_ANALYSIS_USER_PROMPT,
    CLAUDE_VISION_PROMPT,
    QWEN_VISION_PROMPT,
    VIP_ANALYSIS_INSTRUCTION,
} from "@/config/ai-prompts";
import { getSession, isVipCheck } from "@/lib/auth";
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
        const limit = await rateLimit(`face-analyze-${ip}`, "face-analyze", { maxRequests: 60 }); // Increased for testing

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

        // Dynamic imports for file handling
        const fs = await import('fs/promises');
        const path = await import('path');
        const process = await import('process');
        // Lazy import sharp
        let sharp: any;
        try {
            sharp = (await import('sharp')).default;
        } catch (e) {
            aiLogger.warn("Sharp module not found, compression disabled");
        }

        // Helper to resolve and optionally compress image data
        const resolveImageData = async (imgData: string, compress: boolean = false) => {
            if (!imgData) return null;
            if (imgData.startsWith('http')) return imgData; // Full URL

            // Handle Local Files
            let buffer: Buffer | null = null;
            let mimeType = 'image/jpeg';

            if ((imgData.startsWith('/') || imgData.startsWith('\\')) && !imgData.startsWith('data:')) {
                try {
                    const relativePath = imgData.startsWith('/') ? imgData.slice(1) : imgData;

                    // Security: resolve and whitelist to public/uploads only
                    const uploadRoot = path.resolve(process.cwd(), 'public', 'uploads');
                    const normalized = path.normalize(relativePath);

                    if (path.isAbsolute(normalized) || normalized.startsWith('..') || normalized.includes('..' + path.sep)) {
                        aiLogger.warn(`Blocked path traversal attempt: ${imgData}`);
                        return null;
                    }

                    let filePath: string;
                    if (normalized.startsWith('uploads/') || normalized.startsWith('uploads\\')) {
                        filePath = path.resolve(process.cwd(), 'public', normalized);
                    } else {
                        filePath = path.resolve(uploadRoot, normalized);
                    }

                    if (!filePath.startsWith(uploadRoot + path.sep) && filePath !== uploadRoot) {
                        aiLogger.warn(`Blocked out-of-bounds file access: ${imgData}`);
                        return null;
                    }

                    buffer = await fs.readFile(filePath);
                    const ext = path.extname(filePath).toLowerCase();
                    mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
                } catch (e: any) {
                    aiLogger.warn(`Failed to resolve local image path: ${imgData}`, { error: e.message });
                    return null;
                }
            } else if (imgData.startsWith('data:')) {
                if (compress) {
                    try {
                        const base64Data = imgData.split(',')[1];
                        mimeType = imgData.split(';')[0].split(':')[1] || 'image/jpeg';
                        buffer = Buffer.from(base64Data, 'base64');
                    } catch (e: any) {
                        aiLogger.warn("Failed to decode base64 image for compression", { error: e.message });
                        return imgData; // fallback
                    }
                } else {
                    return imgData; // Return base64 as is if not compressing
                }
            } else {
                return imgData; // Return as is
            }

            // Compression
            if (compress && buffer && sharp) {
                try {
                    aiLogger.info(`Compressing image for retry...`);
                    buffer = await sharp(buffer)
                        .resize({ width: 1024, fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: 75 })
                        .toBuffer();
                    mimeType = 'image/jpeg';
                } catch (e: any) {
                    aiLogger.error("Image compression failed", e);
                }
            }

            if (buffer) {
                return `data:${mimeType};base64,${buffer.toString('base64')}`;
            }
            return imgData;
        };

        // Encapsulate Image Loading Logic
        const loadImages = async (compress: boolean) => {
            const loadedCoordinates: VisionImage[] = [];
            const { images, image } = result.data;

            if (Array.isArray(images)) {
                for (const img of images) {
                    if (img.data) {
                        const data = await resolveImageData(img.data, compress);
                        if (data) loadedCoordinates.push({ angle: img.angle || "front", data });
                    }
                }
            } else if (images && !Array.isArray(images)) {
                const imgs = images as { front?: string; left?: string; right?: string; chin?: string };
                if (imgs.front) {
                    const data = await resolveImageData(imgs.front, compress);
                    if (data) loadedCoordinates.push({ angle: "正脸", data });
                }
                if (imgs.left) {
                    const data = await resolveImageData(imgs.left, compress);
                    if (data) loadedCoordinates.push({ angle: "左侧脸", data });
                }
                if (imgs.right) {
                    const data = await resolveImageData(imgs.right, compress);
                    if (data) loadedCoordinates.push({ angle: "右侧脸", data });
                }
                if (imgs.chin) {
                    const data = await resolveImageData(imgs.chin, compress);
                    if (data) loadedCoordinates.push({ angle: "下巴/颈部", data });
                }
            } else if (image) {
                const data = await resolveImageData(image, compress);
                if (data) loadedCoordinates.push({ angle: "正脸", data });
            }
            return loadedCoordinates;
        };

        // Initial Load (Compressed Quality to prevent Payload Too Large & reduce latency)
        let validImages = await loadImages(true);

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

        // --- VIP Prompt Injection ---
        const session = await getSession();
        // Use shared isVipCheck which validates role + vipExpiresAt expiration
        const isVip = isVipCheck(session);

        if (isVip && VIP_ANALYSIS_INSTRUCTION) {
            systemPrompt += `\n\n${VIP_ANALYSIS_INSTRUCTION}`;
            aiLogger.info(`[FaceAnalyze] VIP mode activated for user ${session?.id}`);
        }
        // ----------------------------

        let acquired = false;
        try {
            // P3: 请求队列处理 - 申请令牌
            // 这是一个异步操作，如果队列已满会等待，直到超时
            aiLogger.debug(`[Queue] Requesting lock. Stats:`, visionQueue.getStats() as any);
            await visionQueue.acquire();
            acquired = true;
            aiLogger.debug(`[Queue] Lock acquired.`);

            // 4. 调用 AI 分析 (包含重试机制)
            let analysisResult;
            try {
                analysisResult = await analyzeImages(
                    validImages,
                    systemPrompt,
                    VISION_ANALYSIS_USER_PROMPT,
                    provider as any
                );
            } catch (e: any) {
                // Retry if payload error
                const isPayloadError = e.message?.includes('400') || e.message?.includes('base64') || e.message?.includes('too large');
                if (isPayloadError) {
                    aiLogger.warn(`[FaceAnalyze] Payload error (${e.message}), retrying with compression...`);
                    // Reload with compression
                    validImages = await loadImages(true);

                    analysisResult = await analyzeImages(
                        validImages,
                        systemPrompt,
                        VISION_ANALYSIS_USER_PROMPT,
                        provider as any
                    );
                    aiLogger.info(`[FaceAnalyze] Retry successful.`);
                } else {
                    throw e;
                }
            }

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

            aiLogger.warn("Using fallback result due to AI error");
            return NextResponse.json(getDefaultFaceAnalysisResult());
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
