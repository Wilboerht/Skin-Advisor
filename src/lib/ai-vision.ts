import {
    getAISettings,
    getApiKeysForProvider,
    createOpenAIClient,
    isAllowedAIModel,
    PROVIDER_FALLBACK_CHAIN,
    type AIProvider,
    type AISettings
} from "./ai";
import { aiLogger } from "./logger";
import { circuitBreaker } from "./circuit-breaker";
import { checkAIBudget, recordAIUsage, releasePendingReservation, isBudgetSafeForRetry } from "./ai-budget";
import { filterHealthyKeys, recordKeyResult } from "./ai-key-health";
import {
    VISION_ANALYSIS_SYSTEM_PROMPT,
    QWEN_VISION_PROMPT
} from "@/config/ai-prompts";
import {
    validateAndExtractJson,
    VisionAnalysisOutputSchema,
} from "./advisor-utils";

export interface VisionImage {
    data: string; // base64 string (data:image/...)
    angle?: string;
}

// 辅助函数：延迟
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 计算指数退避延迟
 * @param attempt 当前尝试次数（从 1 开始）
 * @param baseDelay 基础延迟
 * @param maxDelay 最大延迟
 */
function exponentialBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
    return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
}

/**
 * 合并多个 AbortSignal，任一 abort 则合并后的 signal abort
 */
function mergeAbortSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
    const controller = new AbortController();
    const onAbort = () => {
        controller.abort();
        signals.forEach(s => s?.removeEventListener('abort', onAbort));
    };
    signals.forEach(s => {
        if (s?.aborted) { controller.abort(); return; }
        s?.addEventListener('abort', onAbort, { once: true });
    });
    return controller.signal;
}

/**
 * 视觉分析主函数 (支持多 Key 轮询)
 * @param userId - 可选登录用户ID，用于单用户每日AI调用硬限流
 */
export async function analyzeImages(
    images: VisionImage[],
    _defaultSystemPrompt: string, // 保留参数兼容，但内部优先用配置
    userPrompt: string,
    _defaultProvider: AIProvider = "qwen",
    signal?: AbortSignal,
    userId?: string | null,
    sessionId?: string | null
) {
    // 如果外部 signal 已 abort，直接抛出
    if (signal?.aborted) {
        throw new Error("Vision request cancelled by client.");
    }
    // 0. 全局预算熔断检查（vision 类型预估 ¥0.30 覆盖 qwen-vl-max 多图上限场景）
    const budgetStatus = await checkAIBudget("vision", 0.30, userId);
    if (!budgetStatus.allowed) {
        throw new Error(`[AIBudget] ${budgetStatus.reason}`);
    }

    try {
        // 1. 获取配置
        const settings = await getAISettings();
        const primaryProvider = (settings.visionProvider || _defaultProvider) as AIProvider;
        const fallbackList = PROVIDER_FALLBACK_CHAIN[primaryProvider] || [];
        const providerQueue = [primaryProvider, ...fallbackList];

        // 2. 准备 Prompt 上下文
        let finalUserPrompt = userPrompt;
        if (images.length > 1) {
            const angles = images.map(i => i.angle || 'unknown').join(', ');
            finalUserPrompt += `\n\n我提供了${images.length}张照片，分别是：${angles}。请综合分析所有照片。`;
        }

        let lastError: Error | null = null;

        for (const provider of providerQueue) {
            const isPrimary = provider === primaryProvider;
            let model = isPrimary ? (settings.visionModel || getDefaultVisionModel(provider)) : getDefaultVisionModel(provider);

            // 模型白名单校验（防止被切到高价视觉模型）
            if (!isAllowedAIModel(provider, model)) {
                const fallbackModel = getDefaultVisionModel(provider);
                aiLogger.warn(`[AISettings] Rejected illegal vision model: ${provider}/${model}, fallback to ${fallbackModel}`);
                model = fallbackModel;
            }

            // 获取 prompt (优先数据库配置)
            const systemPrompt = getVisionSystemPrompt(provider, settings) || _defaultSystemPrompt;

            // 视觉 system prompt 长度保护：防止自定义 DB prompt 膨胀请求
            const MAX_VISION_SYSTEM_PROMPT_CHARS = 4000;
            let safeSystemPrompt = systemPrompt;
            if (systemPrompt.length > MAX_VISION_SYSTEM_PROMPT_CHARS) {
                safeSystemPrompt = systemPrompt.slice(0, MAX_VISION_SYSTEM_PROMPT_CHARS) +
                    "\n\n[提示：系统提示词过长，已截断以控制成本]";
                aiLogger.warn(`Vision system prompt truncated: ${systemPrompt.length} -> ${safeSystemPrompt.length} chars`);
            }

            aiLogger.info(`Starting Vision Analysis: ${provider} (${model})`, { imageCount: images.length, isFallback: !isPrimary });

            try {
                const result = await tryVisionProviderWithKeys(
                    provider,
                    model,
                    images,
                    safeSystemPrompt,
                    finalUserPrompt,
                    signal,
                    userId,
                    sessionId
                );
                return result;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                if (error.name === 'AbortError' || signal?.aborted) {
                    throw new Error("Vision request cancelled by client.");
                }
                lastError = error;
                aiLogger.warn(`Vision provider ${provider} failed: ${error.message}. Switching to next...`);
                continue;
            }
        }

        throw lastError || new Error("Vision analysis failed after exhausting all providers.");
    } finally {
        releasePendingReservation("vision", 0.30);
    }
}

/**
 * 单个视觉服务商的多 Key 轮询
 */
async function tryVisionProviderWithKeys(
    provider: AIProvider,
    model: string,
    images: VisionImage[],
    systemPrompt: string,
    userPrompt: string,
    signal?: AbortSignal,
    userId?: string | null,
    sessionId?: string | null
): Promise<Record<string, unknown>> {
    const settings = await getAISettings();

    // 多 Key 轮询机制（带指数退避 + key 健康管理）
    let apiKeys = getApiKeysForProvider(provider, settings);
    if (apiKeys.length === 0) {
        throw new Error(`No API keys found for vision provider: ${provider}`);
    }

    apiKeys = filterHealthyKeys(provider, apiKeys);
    if (apiKeys.length === 0) {
        aiLogger.warn(`All keys for vision ${provider} are in cooldown, trying anyway`);
        apiKeys = getApiKeysForProvider(provider, settings);
    }

    let lastError: Error | null = null;

    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];

        // 每个 Key 只尝试 1 次（载荷错误由外层 face-analyze 重试处理）
        // 避免双层重试导致单次用户请求产生 3 keys × 2 次 = 6 次以上的 API 调用
        try {
            if (i > 0) aiLogger.warn(`Vision Retry: Key ${i + 1}/${apiKeys.length}`);

            const result = await callVisionAPI(provider, apiKey, model, images, systemPrompt, userPrompt, signal, userId, sessionId);

            // 解析与 Zod 结构验证
            const jsonData = validateAndExtractJson(result, VisionAnalysisOutputSchema);

            // 优先检查 validation 拦截状态（非真人/翻拍/遮挡等）
            const validation = jsonData.validation as { isValid?: boolean; message?: string } | undefined;
            if (validation && validation.isValid === false) {
                const reason = validation.message || "图片未通过验证";
                throw new Error(`[Validation] ${reason}`);
            }

            return jsonData; // 成功返回

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            if (error.name === 'AbortError' || signal?.aborted) {
                throw new Error("Vision request cancelled by client.");
            }
            lastError = error;
            aiLogger.warn(`Vision Error (${provider}, key ${i + 1}/${apiKeys.length}): ${error.message}`);

            // 记录 key 健康状态
            recordKeyResult(provider, apiKey, {
                success: false,
                isRateLimit: error.status === 429 || String(error).includes("429"),
                isAuthError: error.status === 401 || error.status === 403 || String(error).includes("401") || String(error).includes("403"),
            });

            const status = error.status;
            const isAuth = status === 401 || status === 403 || String(error).includes("401") || String(error).includes("403");
            const isRateLimit = status === 429 || String(error).includes("429");
            const isServerError = status && status >= 500;

            // 认证错误直接换 Key
            if (isAuth) continue;

            // 限流/服务端错误：换 Key 前指数退避
            if (isRateLimit || isServerError) {
                const isLastKey = i >= apiKeys.length - 1;
                if (!isLastKey) {
                    const baseDelay = isRateLimit ? 1000 : 500;
                    const maxDelay = isRateLimit ? 8000 : 4000;
                    const delayMs = exponentialBackoff(i + 1, baseDelay, maxDelay);
                    aiLogger.warn(`Vision ${provider} ${isRateLimit ? '429' : '5xx'}, backing off ${delayMs}ms before next key`);
                    await delay(delayMs);
                    if (signal?.aborted) {
                        throw new Error("Vision request cancelled during backoff.");
                    }
                }
                continue;
            }

            // 其他错误 (如 400) 直接换 Key
            // 重试前轻量预算检查：在途预留过高时中止重试
            if (!isBudgetSafeForRetry("vision")) {
                aiLogger.warn(`Vision AI retry aborted: pending reservation approaching budget limit`);
                throw new Error(`[AIBudget] Vision retry budget limit approaching, request rejected`);
            }
            continue;
        }
    }

    throw lastError || new Error(`Vision analysis failed after exhausting all keys for ${provider}.`);
}

// ============================================================================
// 内部调用逻辑
// ============================================================================

async function callVisionAPI(
    provider: AIProvider,
    apiKey: string,
    model: string,
    images: VisionImage[],
    systemPrompt: string,
    userPrompt: string,
    signal?: AbortSignal,
    userId?: string | null,
    sessionId?: string | null
): Promise<string> {
    // DeepSeek 和 Qwen 均使用 OpenAI 兼容接口
    return callOpenAICompatibleVision(provider, apiKey, model, images, systemPrompt, userPrompt, signal, userId, sessionId);
}

async function callOpenAICompatibleVision(
    provider: AIProvider,
    apiKey: string,
    model: string,
    images: VisionImage[],
    systemPrompt: string,
    userPrompt: string,
    signal?: AbortSignal,
    userId?: string | null,
    sessionId?: string | null
) {
    const serviceKey = `vision-${provider}`;

    // 熔断器检查
    if (!circuitBreaker.allowRequest(serviceKey)) {
        throw new Error(`[CircuitBreaker] Vision AI service ${provider} is temporarily unavailable (circuit open)`);
    }

    const client = createOpenAIClient(provider, apiKey);

    // 合并外部 signal + 内部 90s 超时，防止 SDK 无限挂起
    // qwen-vl-max 4图实测 48-50s，给足余量避免生产截断
    const visionTimeout = new AbortController();
    const visionTimeoutId = setTimeout(() => visionTimeout.abort(), 90000);
    const mergedSignal = mergeAbortSignals(signal, visionTimeout.signal);
    const cleanupTimeout = () => clearTimeout(visionTimeoutId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [
        { type: "text", text: userPrompt }
    ];

    // 估算图片 Base64 大小用于日志
    let totalImageBytes = 0;
    images.forEach(img => {
        // Ensure data URI format and validate early
        let url = img.data;
        const dataUrlRegex = /^data:image\/[^;]+;base64,/;

        if (url.startsWith("data:")) {
            if (!dataUrlRegex.test(url)) {
                throw new Error(`[Validation] 图片数据格式无效：${img.angle || 'unknown'} 角度缺少有效的 base64 数据 URL 前缀`);
            }
        } else if (!url.startsWith("http")) {
            // Treat as plain base64: strip whitespace and validate
            const cleaned = url.replace(/\s/g, "");
            const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
            if (!base64Regex.test(cleaned) || cleaned.length % 4 !== 0) {
                throw new Error(`[Validation] 图片数据格式无效：${img.angle || 'unknown'} 角度无法识别为有效的 base64 或 URL`);
            }
            url = `data:image/jpeg;base64,${cleaned}`;
        }

        if (url.startsWith("data:")) {
            // 使用实际字节数而非字符串长度，更准确的遥测
            const base64Part = url.split(',')[1] || "";
            totalImageBytes += Buffer.byteLength(base64Part, 'base64');
        }

        content.push({
            type: "image_url",
            image_url: {
                url: url,
            },
        });
    });

    const startedAt = Date.now();
    let response;
    try {
        response = await client.chat.completions.create(
            {
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content },
                ],
                max_tokens: 2500,
                temperature: 0.2
            },
            { signal: mergedSignal }
        );
    } catch (err) {
        cleanupTimeout();
        // 记录失败到熔断器（AbortError 除外，那是客户端主动取消）
        const e = err as Error & { name?: string };
        const isTimeout = e.name === 'AbortError' && !signal?.aborted;

        // 记录失败/超时调用
        await recordAIUsage({
            provider,
            model,
            requestType: "vision",
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            durationMs: Date.now() - startedAt,
            success: false,
            errorCode: isTimeout ? "timeout" : e.message?.slice(0, 200),
            userId,
            sessionId,
        });

        if (!isTimeout && !signal?.aborted) {
            circuitBreaker.recordFailure(serviceKey);
        }
        throw err;
    }

    // 记录 Token 消耗日志
    const usage = response.usage;
    const durationMs = Date.now() - startedAt;
    if (usage) {
        aiLogger.info(`[TokenUsage] Vision AI (${provider}/${model})`, {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
            imageCount: images.length,
            imageDataKB: Math.round(totalImageBytes / 1024),
            durationMs,
        });
        // 持久化到数据库，用于成本审计与预算熔断
        await recordAIUsage({
            provider,
            model,
            requestType: "vision",
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0,
            durationMs,
            success: true,
            userId,
            sessionId,
        });
    }

    // 记录成功到熔断器
    circuitBreaker.recordSuccess(serviceKey);
    cleanupTimeout();

    return response.choices[0]?.message?.content || "";
}

// 辅助：获取默认视觉模型
function getDefaultVisionModel(provider: AIProvider): string {
    if (process.env.AI_VISION_MODEL) return process.env.AI_VISION_MODEL;
    switch (provider) {
        case "qwen": return "qwen-vl-plus";
        case "deepseek": return "deepseek-vl";
        default: return "qwen-vl-plus";
    }
}

// 辅助：获取视觉专用 Prompt
function getVisionSystemPrompt(provider: AIProvider, settings: AISettings): string {
    // 如果数据库配了 visionSystemPrompt，优先使用
    if (settings.visionSystemPrompt) return settings.visionSystemPrompt;

    // 否则根据 active provider 返回预设
    if (provider === "qwen") return QWEN_VISION_PROMPT || "";

    // 默认 (DeepSeek 等 OpenAI 兼容接口)
    return VISION_ANALYSIS_SYSTEM_PROMPT;
}

