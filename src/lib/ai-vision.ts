import {
    getAISettings,
    getApiKeysForProvider,
    createOpenAIClient,
    isAllowedAIModel,
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
import { extractJsonFromResponse } from "./advisor-utils";

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
    userId?: string | null
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
    // 优先使用数据库配置的 provider，如果没有则回退到传入参数或默认值
    const provider = (settings.visionProvider || _defaultProvider) as AIProvider;
    let model = settings.visionModel || getDefaultVisionModel(provider);

    // 模型白名单校验（防止被切到高价视觉模型）
    if (!isAllowedAIModel(provider, model)) {
        const fallbackModel = getDefaultVisionModel(provider);
        aiLogger.warn(`[AISettings] Rejected illegal vision model: ${provider}/${model}, fallback to ${fallbackModel}`);
        model = fallbackModel;
    }

    // 获取 prompt (优先数据库配置)
    const systemPrompt = getVisionSystemPrompt(provider, settings) || _defaultSystemPrompt;

    aiLogger.info(`Starting Vision Analysis: ${provider} (${model})`, { imageCount: images.length });

    // 2. 准备 Prompt 上下文
    let finalUserPrompt = userPrompt;
    if (images.length > 1) {
        const angles = images.map(i => i.angle || 'unknown').join(', ');
        finalUserPrompt += `\n\n我提供了${images.length}张照片，分别是：${angles}。请综合分析所有照片。`;
    }

    // 3. 多 Key 轮询机制（带指数退避 + key 健康管理）
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

            const result = await callVisionAPI(provider, apiKey, model, images, systemPrompt, finalUserPrompt, signal);

            // 解析与验证
            const jsonData = extractJsonFromResponse<Record<string, unknown>>(result);
            if (!jsonData) throw new Error("Failed to parse JSON from Vision API");

            // 结构验证：必须包含核心分析字段，且 dimensions 应为对象
            const hasDimensions = jsonData.dimensions && typeof jsonData.dimensions === 'object';
            const hasSkinType = jsonData.skinType && typeof jsonData.skinType === 'object';
            const hasFaceAnalysis = jsonData.faceAnalysis && typeof jsonData.faceAnalysis === 'object';
            if (!hasDimensions && !hasSkinType && !hasFaceAnalysis) {
                throw new Error("AI response structure missing critical fields (dimensions/skinType/faceAnalysis)");
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

    throw lastError || new Error("Vision analysis failed after exhausting all keys.");
    } finally {
        releasePendingReservation("vision", 0.30);
    }
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
    signal?: AbortSignal
): Promise<string> {
    // DeepSeek 和 Qwen 均使用 OpenAI 兼容接口
    return callOpenAICompatibleVision(provider, apiKey, model, images, systemPrompt, userPrompt, signal);
}

async function callOpenAICompatibleVision(
    provider: AIProvider,
    apiKey: string,
    model: string,
    images: VisionImage[],
    systemPrompt: string,
    userPrompt: string,
    signal?: AbortSignal
) {
    const serviceKey = `vision-${provider}`;

    // 熔断器检查
    if (!circuitBreaker.allowRequest(serviceKey)) {
        throw new Error(`[CircuitBreaker] Vision AI service ${provider} is temporarily unavailable (circuit open)`);
    }

    const client = createOpenAIClient(provider, apiKey);

    // 合并外部 signal + 内部 50s 超时，防止 SDK 无限挂起
    const visionTimeout = new AbortController();
    const visionTimeoutId = setTimeout(() => visionTimeout.abort(), 50000);
    const mergedSignal = mergeAbortSignals(signal, visionTimeout.signal);
    const cleanupTimeout = () => clearTimeout(visionTimeoutId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [
        { type: "text", text: userPrompt }
    ];

    // 估算图片 Base64 大小用于日志
    let totalImageBytes = 0;
    images.forEach(img => {
        // Ensure data URI format
        let url = img.data;
        if (!url.startsWith("http") && !url.startsWith("data:")) {
            url = `data:image/jpeg;base64,${url}`;
        }
        if (url.startsWith("data:")) {
            totalImageBytes += url.length;
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

