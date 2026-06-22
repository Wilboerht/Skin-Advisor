import { NextRequest, NextResponse } from "next/server";

import { analyzeImages, type VisionImage } from "@/lib/ai-vision";
import type { AIProvider } from "@/lib/ai";
import { isAIEnabled } from "@/lib/ai";
import { FaceAnalyzeRequestSchema } from "@/lib/schemas";
import {
    VISION_ANALYSIS_SYSTEM_PROMPT,
    VISION_ANALYSIS_USER_PROMPT,
    QWEN_VISION_PROMPT,
    VIP_ANALYSIS_INSTRUCTION,
} from "@/config/ai-prompts";
import { getSession, isVipCheck } from "@/lib/auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { reserveUsage } from "@/lib/usage-limit";
import { aiLogger } from "@/lib/logger";
import { getDefaultFaceAnalysisResult } from "@/lib/advisor-utils";
import { visionQueue } from "@/lib/ai-queue";

export const maxDuration = 60; // 防止超时

export async function POST(request: NextRequest) {
    // 创建 AbortController 用于服务端超时和客户端断开取消 AI 请求
    const abortController = new AbortController();
    const serverTimeout = setTimeout(() => abortController.abort(), 55 * 1000);

    const onClientAbort = () => {
        clearTimeout(serverTimeout);
        abortController.abort();
    };
    request.signal.addEventListener('abort', onClientAbort);

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
        const ip = getClientIP(request);
        const limit = await rateLimit(`face-analyze-${ip}`, "face-analyze");

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

        // 1.5 每日用量上限预占（face-analyze 独立消耗一次额度）
        const faceSessionId = crypto.randomUUID();
        const usageReserve = await reserveUsage(request, faceSessionId);
        if (!usageReserve.success) {
            return NextResponse.json(
                { error: usageReserve.error || "今日测试次数已用完，请明天再试" },
                { status: 429, headers: rateLimitHeaders }
            );
        }

        // 2. 解析与验证（带 guard，malformed JSON 返回 400 而非 500）
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "无效的请求体，请检查 JSON 格式" },
                { status: 400 }
            );
        }
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

        // 收集需要清理的非 front 上传照片（front 留给 avatar processor）
        const isFrontAngle = (angle: string | undefined) => angle === "正脸" || angle === "front";
        const uploadedFaceUrls = validImages
            .filter(img => !!img.data && img.data.startsWith('http') && !isFrontAngle(img.angle))
            .map(img => img.data);

        if (validImages.length === 0) {
            return NextResponse.json({ error: "无有效图片数据" }, { status: 400 });
        }

        aiLogger.info(`Starting face analysis for IP ${ip} with ${validImages.length} images`);

        // 3. 准备提示词与 Provider
        const provider = process.env.AI_VISION_PROVIDER || "qwen";
        let systemPrompt = VISION_ANALYSIS_SYSTEM_PROMPT;

        if (provider === "qwen") {
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
            await visionQueue.acquire({ signal: abortController.signal });
            acquired = true;
            aiLogger.debug(`[Queue] Lock acquired.`);

            // 4. 调用 AI 分析 (包含重试机制)
            let analysisResult: Record<string, unknown>;
            try {
                analysisResult = await analyzeImages(
                    validImages,
                    systemPrompt,
                    VISION_ANALYSIS_USER_PROMPT,
                    provider as AIProvider,
                    abortController.signal
                ) as Record<string, unknown>;
            } catch (e: unknown) {
                const err = e as Error;
                if (err.message?.includes("cancelled") || err.name === 'AbortError') {
                    throw new Error("Face analysis cancelled (client timeout or disconnect)");
                }
                // Retry if payload error
                const isPayloadError = err.message?.includes('400') || err.message?.includes('413') || err.message?.includes('base64') || err.message?.includes('too large') || err.message?.includes('content length') || err.message?.includes('payload');
                if (isPayloadError) {
                    aiLogger.warn(`[FaceAnalyze] Payload error (${err.message}), retrying with aggressive compression...`);
                    // 对现有图片做更强压缩（512px / quality 60），而不是重新加载
                    if (sharp) {
                        validImages = await Promise.all(validImages.map(async (img) => {
                            if (!img.data || img.data.startsWith('http')) return img;
                            try {
                                const base64Data = img.data.split(',')[1];
                                const buffer = Buffer.from(base64Data, 'base64');
                                const compressed = await sharp(buffer)
                                    .resize({ width: 512, fit: 'inside', withoutEnlargement: true })
                                    .jpeg({ quality: 60 })
                                    .toBuffer();
                                return { ...img, data: `data:image/jpeg;base64,${compressed.toString('base64')}` };
                            } catch (compErr: unknown) {
                                aiLogger.warn("Aggressive compression failed", { error: compErr as Error });
                                return img;
                            }
                        }));
                    }

                    analysisResult = await analyzeImages(
                        validImages,
                        systemPrompt,
                        VISION_ANALYSIS_USER_PROMPT,
                        provider as AIProvider,
                        abortController.signal
                    ) as Record<string, unknown>;
                    aiLogger.info(`[FaceAnalyze] Retry successful.`);
                } else {
                    throw e;
                }
            }

            // 5. 结果校验
            const validation = analysisResult.validation as Record<string, unknown> | undefined;
            if (validation && validation.isValid === false) {
                aiLogger.warn(`Face validation failed: ${validation.message}`);
                return NextResponse.json(
                    {
                        error: "图片验证失败",
                        message: validation.message || "未检测到清晰人脸，请重新拍摄",
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

        } catch (aiError: unknown) {
            const aiErr = aiError as Error;
            const err = aiError instanceof Error ? aiError : new Error(String(aiError));
            aiLogger.error("AI Analysis Failed", { error: err.message });

            // 队列超时特有错误
            if (err.message?.includes("Queue timeout") || err.message?.includes("Server busy")) {
                return NextResponse.json(
                    { error: "服务器繁忙，请稍后再试", code: "SERVER_BUSY" },
                    { status: 503, headers: { "Retry-After": "30" } }
                );
            }

            aiLogger.warn("Using fallback result due to AI error");
            // 返回错误而不是假数据，避免误导用户
            return NextResponse.json(
                { error: "AI 分析服务暂时不可用，请稍后重试", code: "AI_UNAVAILABLE" },
                { status: 503, headers: { "Retry-After": "60" } }
            );
        } finally {
            // P3: 释放令牌
            if (acquired) {
                visionQueue.release();
                aiLogger.debug(`[Queue] Lock released. Stats:`, visionQueue.getStats() as any);
            }

            // 清理非 front 的上传照片（front 留给 avatar processor）
            if (uploadedFaceUrls.length > 0) {
                Promise.resolve().then(async () => {
                    const { deleteSourcePhoto } = await import("@/lib/file-cleanup");
                    for (const url of uploadedFaceUrls) {
                        try {
                            await deleteSourcePhoto(url);
                        } catch (e) {
                            console.warn(`[FaceAnalyze] Failed to delete uploaded photo ${url}:`, e);
                        }
                    }
                });
            }
        }

    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (err.message?.includes("cancelled") || (err as { name?: string }).name === 'AbortError') {
            return NextResponse.json(
                { error: "分析请求已取消，请重试" },
                { status: 499 }
            );
        }
        console.error("Critical error in face analysis:", err);
        return NextResponse.json(
            { error: "服务器内部错误" },
            { status: 500 }
        );
    } finally {
        clearTimeout(serverTimeout);
        request.signal.removeEventListener('abort', onClientAbort);
    }
}
