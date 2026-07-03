import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { analyzeImages, type VisionImage } from "@/lib/ai-vision";
import type { AIProvider } from "@/lib/ai";
import { isAIEnabled } from "@/lib/ai";
import { circuitBreaker } from "@/lib/circuit-breaker";
import { FaceAnalyzeRequestSchema } from "@/lib/schemas";
import {
    VISION_ANALYSIS_SYSTEM_PROMPT,
    VISION_ANALYSIS_USER_PROMPT,
    QWEN_VISION_PROMPT,
    REGISTERED_USER_DEEP_ANALYSIS_INSTRUCTION,
} from "@/config/ai-prompts";
import { getSession } from "@/lib/auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { reserveUsage, rollbackUsage } from "@/lib/usage-limit";
import { aiLogger } from "@/lib/logger";

import { visionQueue } from "@/lib/ai-queue";

export const maxDuration = 60; // 防止超时

// 脸部分析结果缓存（图片 hash -> 分析结果）
// 同一用户重复上传相同图片时跳过 AI 调用，节省成本
const faceAnalysisCache = new Map<string, { result: Record<string, unknown>; at: number; sessionId: string }>();
const FACE_CACHE_TTL_MS = 10 * 60 * 1000; // 10分钟过期
const FACE_CACHE_MAX_SIZE = 50; // 最多缓存 50 条

function buildCacheKey(_sessionId: string, images: VisionImage[]): string {
    // 仅基于图片内容哈希（不含 sessionId），这样刷新页面也能命中缓存
    const samples = images.map(img => {
        const data = img.data || "";
        return `${img.angle}:${crypto.createHash("md5").update(data.slice(0, 1024)).digest("hex")}`;
    }).join("|");
    return `face:${crypto.createHash("md5").update(samples).digest("hex")}`;
}

function getCachedResult(key: string): Record<string, unknown> | null {
    const entry = faceAnalysisCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.at > FACE_CACHE_TTL_MS) {
        faceAnalysisCache.delete(key);
        return null;
    }
    // 清理最老的缓存项
    if (faceAnalysisCache.size >= FACE_CACHE_MAX_SIZE) {
        const oldest = [...faceAnalysisCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (oldest) faceAnalysisCache.delete(oldest[0]);
    }
    return entry.result;
}

function setCachedResult(key: string, sessionId: string, result: Record<string, unknown>): void {
    faceAnalysisCache.set(key, { result, at: Date.now(), sessionId });
}

export async function POST(request: NextRequest) {
    // 创建 AbortController 用于服务端超时和客户端断开取消 AI 请求
    const abortController = new AbortController();
    const serverTimeout = setTimeout(() => abortController.abort(), 55 * 1000);

    const onClientAbort = () => {
        clearTimeout(serverTimeout);
        abortController.abort();
    };
    request.signal.addEventListener('abort', onClientAbort);

    // 0.1 拒绝超大请求体（> 10MB），防止恶意大文件耗尽带宽
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 10 * 1024 * 1024) {
        return NextResponse.json(
            { error: "图片过大，请压缩后上传" },
            { status: 413 }
        );
    }

    // 在 try 外部声明，供 catch/finally 回滚额度时使用
    let body: Record<string, unknown> | undefined;
    let faceSessionId: string | undefined;

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

        // 0. 熔断器检查
        const visionServiceKey = `vision-${process.env.AI_VISION_PROVIDER || "qwen"}`;
        if (!circuitBreaker.allowRequest(visionServiceKey)) {
            return NextResponse.json(
                { error: "AI 视觉服务暂时不可用（熔断保护），请稍后重试", code: "CIRCUIT_OPEN" },
                { status: 503, headers: { "Retry-After": "60" } }
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

        // 2. 解析与验证（带 guard，malformed JSON 返回 400 而非 500）
        let rawBody: unknown;
        try {
            rawBody = await request.json();
        } catch {
            return NextResponse.json(
                { error: "无效的请求体，请检查 JSON 格式" },
                { status: 400 }
            );
        }
        body = rawBody as Record<string, unknown>;
        const result = FaceAnalyzeRequestSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "无效的请求数据", details: result.error.flatten() },
                { status: 400 }
            );
        }

        // 1.5 每日用量上限预占（复用业务 sessionId，避免与 analyze 重复扣费）
        faceSessionId = result.data.sessionId || crypto.randomUUID();
        const usageReserve = await reserveUsage(request, faceSessionId, body);
        if (!usageReserve.success) {
            return NextResponse.json(
                { error: usageReserve.error || "今日测试次数已用完，请明天再试" },
                { status: 429, headers: rateLimitHeaders }
            );
        }

        // Dynamic imports for file handling
        const fs = await import('fs/promises');
        const path = await import('path');
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

                    // 统一使用标准化后的绝对路径做白名单校验，避免平台分隔符差异被绕过
                    const filePath = path.resolve(uploadRoot, normalized);
                    const resolvedRoot = path.resolve(uploadRoot);
                    if (!filePath.startsWith(resolvedRoot + path.sep) && filePath !== resolvedRoot) {
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
            // 首次即使用较激进压缩（512px / quality 70），避免大图触发 400/413 后二次跑 vision 模型
            if (compress && buffer && sharp) {
                try {
                    aiLogger.info(`Compressing image...`);
                    buffer = await sharp(buffer)
                        .resize({ width: 512, fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: 70 })
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

        // 收集所有需要清理的上传照片 URL
        const uploadedFaceUrls = validImages
            .filter(img => !!img.data && img.data.startsWith('http'))
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

        // --- Registered user deep analysis prompt injection ---
        const session = await getSession();
        const isLoggedIn = !!session;

        if (isLoggedIn && REGISTERED_USER_DEEP_ANALYSIS_INSTRUCTION) {
            systemPrompt += `\n\n${REGISTERED_USER_DEEP_ANALYSIS_INSTRUCTION}`;
            aiLogger.info(`[FaceAnalyze] Deep analysis mode activated for user ${session?.id}`);
        }
        // --------------------------------------------------------

        let acquired = false;
        try {
            // 3.5 缓存检查：相同图片跳过 AI 调用（必须在队列获取之前，避免浪费槽位）
            const cacheKey = buildCacheKey(faceSessionId || ip, validImages);
            const cachedResult = getCachedResult(cacheKey);
            if (cachedResult) {
                aiLogger.info(`[FaceAnalyze] Cache hit, returning cached result`);
                return NextResponse.json(cachedResult, {
                    headers: {
                        ...rateLimitHeaders,
                        "X-Cache": "HIT",
                        "X-Queue-Position": "0",
                        "X-Queue-Wait-Seconds": "0",
                    }
                });
            }

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
                    // 重试前本地验证：计算当前图片总大小，如果在合理范围内则不重试
                    const totalBase64KB = validImages.reduce((sum, img) => {
                        return sum + (img.data?.startsWith('data:') ? img.data.length / 1024 : 0);
                    }, 0);
                    const perImageAvgKB = totalBase64KB / Math.max(1, validImages.length);

                    // 如果单张图片平均已经 < 100KB base64，说明不是图片大小导致的问题
                    if (perImageAvgKB < 100) {
                        aiLogger.warn(`[FaceAnalyze] Payload error but images already small (avg ${perImageAvgKB.toFixed(0)}KB), not retrying`);
                        // 回滚预占（非用户原因）
                        await rollbackUsage(request, faceSessionId, body as Record<string, unknown>);
                        return NextResponse.json(
                            { error: "AI 视觉服务请求异常，请稍后重试", code: "AI_PAYLOAD_ERROR" },
                            { status: 503, headers: { "Retry-After": "30" } }
                        );
                    }

                    aiLogger.warn(`[FaceAnalyze] Payload error (${err.message}), retrying with aggressive compression (current: ${totalBase64KB.toFixed(0)}KB total)`);
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
                // 图片验证失败属于非用户主动消耗额度场景，回滚预占
                await rollbackUsage(request, faceSessionId, body as Record<string, unknown>);
                return NextResponse.json(
                    {
                        error: "图片验证失败",
                        message: validation.message || "未检测到清晰人脸，请重新拍摄",
                        code: "VALIDATION_FAILED"
                    },
                    { status: 400 }
                );
            }

            // 缓存有效结果（不含 validation 字段的纯结果）
            setCachedResult(cacheKey, faceSessionId || ip, analysisResult);

            return NextResponse.json(analysisResult, {
                headers: {
                    ...rateLimitHeaders,
                    "X-Cache": "MISS",
                    "X-Queue-Position": String(visionQueue.getStats().queueLength),
                    "X-Queue-Wait-Seconds": String(visionQueue.getStats().estimatedWaitSeconds)
                }
            });

        } catch (aiError: unknown) {
            const aiErr = aiError as Error;
            const err = aiError instanceof Error ? aiError : new Error(String(aiError));
            aiLogger.error("AI Analysis Failed", { error: err.message });

            // 客户端取消（AI 调用进行中）：Provider 可能已处理并计费，不回滚
            const isClientCancel = err.message?.includes("cancelled") || err.message?.includes("client timeout");
            if (isClientCancel) {
                return NextResponse.json(
                    { error: "分析请求已取消" },
                    { status: 499 }
                );
            }

            // 预算熔断：直接拒绝请求
            if (err.message?.includes("[AIBudget]")) {
                aiLogger.warn("AI vision budget exceeded, rejecting request", { error: err.message });
                await rollbackUsage(request, faceSessionId, body as Record<string, unknown>);
                return NextResponse.json(
                    { error: "AI 视觉服务当前额度已用完，请稍后再试", code: "AI_BUDGET_EXCEEDED" },
                    { status: 503, headers: { "Retry-After": "3600" } }
                );
            }

            // 队列超时特有错误（AI 未被调用，零消耗）
            if (err.message?.includes("Queue timeout") || err.message?.includes("Server busy")) {
                await rollbackUsage(request, faceSessionId, body as Record<string, unknown>);
                return NextResponse.json(
                    { error: "服务器繁忙，请稍后再试", code: "SERVER_BUSY" },
                    { status: 503, headers: { "Retry-After": "30" } }
                );
            }

            // AI 服务不可用（API 错误，Provider 未成功处理），回滚预占
            aiLogger.warn("AI service unavailable, rolling back usage");
            await rollbackUsage(request, faceSessionId, body as Record<string, unknown>);
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

            // 清理上传的照片
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
        // 服务器内部错误，非用户原因，回滚预占
        if (faceSessionId) {
            await rollbackUsage(request, faceSessionId, body);
        }
        // 使用脱敏 logger，避免 error 对象泄露请求上下文
        aiLogger.error("Critical error in face analysis", {
            errorMessage: err.message,
            errorName: err.name,
            sessionId: faceSessionId,
        });
        return NextResponse.json(
            { error: "服务器内部错误" },
            { status: 500 }
        );
    } finally {
        clearTimeout(serverTimeout);
        request.signal.removeEventListener('abort', onClientAbort);
    }
}
