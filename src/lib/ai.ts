import OpenAI from "openai";
import prisma from "./prisma";
import { aiLogger } from "./logger";
import { TEXT_ANALYSIS_SYSTEM_PROMPT } from "@/config/ai-prompts";
import { circuitBreaker } from "./circuit-breaker";
import { checkAIBudget, recordAIUsage, releasePendingReservation, isBudgetSafeForRetry } from "./ai-budget";
import { filterHealthyKeys, recordKeyResult } from "./ai-key-health";
import {
    extractJsonFromResponse,
    getDefaultFaceAnalysisResult,
    identifyConcerns,
    type QuestionnaireAnswers,
    type FaceAnalysisResult
} from "./advisor-utils";

// ============================================================================
// 类型定义
// ============================================================================

export type AIProvider = "deepseek" | "qwen";

export const ALLOWED_AI_PROVIDERS: AIProvider[] = ["deepseek", "qwen"];

export const ALLOWED_AI_MODELS: Record<AIProvider, string[]> = {
    deepseek: ["deepseek-chat", "deepseek-reasoner", "deepseek-vl"],
    qwen: ["qwen-turbo", "qwen-plus", "qwen-max", "qwen-vl-max", "qwen-vl-plus"],
};

/**
 * 校验 provider + model 是否在成本白名单内。
 * 防止配置被写入 gpt-4o、claude-3-opus 等高价模型导致账单失控。
 */
export function isAllowedAIModel(provider: string, model: string): boolean {
    const p = provider as AIProvider;
    if (!ALLOWED_AI_PROVIDERS.includes(p)) return false;
    return ALLOWED_AI_MODELS[p]?.includes(model) ?? false;
}

export interface ApiKeys {
    deepseek?: string;
    qwen?: string;
}

export interface AISettings {
    provider: AIProvider;
    visionProvider: AIProvider;
    model: string;
    visionModel: string;
    textSystemPrompt: string;
    visionSystemPrompt: string;
    maxTokens: number;
    temperature: number;
    apiKeys?: ApiKeys;
}

// 默认设置
// Helper to determine default models based on provider env
// qwen-turbo 全天价格最低（含 DeepSeek 峰谷定价后），视觉用 qwen
const envProvider = process.env.AI_PROVIDER || "qwen";
const envVisionProvider = process.env.AI_VISION_PROVIDER || "qwen";

const DEFAULT_AI_SETTINGS: AISettings = {
    provider: envProvider as AIProvider,
    visionProvider: envVisionProvider as AIProvider,
    model: process.env.AI_MODEL || (envProvider === "qwen" ? "qwen-turbo" : "deepseek-chat"),
    visionModel: process.env.AI_VISION_MODEL || (envVisionProvider === "qwen" ? "qwen-vl-plus" : "deepseek-vl"),
    textSystemPrompt: TEXT_ANALYSIS_SYSTEM_PROMPT,
    visionSystemPrompt: "",
    maxTokens: 2000,
    temperature: 0.3,
    apiKeys: {
        deepseek: process.env.DEEPSEEK_API_KEY,
        qwen: process.env.QWEN_API_KEY,
    },
};

// 服务商降级链（qwen 优先，失败后降级 deepseek）
const PROVIDER_FALLBACK_CHAIN: Record<string, AIProvider[]> = {
    qwen: ["deepseek"],
};

// 缓存配置
let cachedSettings: AISettings | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 60s

/**
 * 手动失效 AI 设置缓存
 * 供管理后台调用，确保配置修改后立即生效
 */
export function invalidateAISettingsCache(): void {
    cachedSettings = null;
    cacheTimestamp = 0;
    aiLogger.info("AI settings cache invalidated");
}

// ============================================================================
// 配置管理
// ============================================================================

/**
 * 安全合并数据库配置，强制校验 provider/model 在白名单内。
 */
function sanitizeAISettings(dbSettings: Partial<AISettings>): AISettings {
    const base = { ...DEFAULT_AI_SETTINGS };

    // 校验 provider
    const provider = (dbSettings.provider || base.provider) as AIProvider;
    if (!ALLOWED_AI_PROVIDERS.includes(provider)) {
        aiLogger.warn(`[AISettings] Rejected illegal provider from DB: ${provider}, fallback to ${base.provider}`);
    } else {
        base.provider = provider;
    }

    const visionProvider = (dbSettings.visionProvider || base.visionProvider) as AIProvider;
    if (!ALLOWED_AI_PROVIDERS.includes(visionProvider)) {
        aiLogger.warn(`[AISettings] Rejected illegal visionProvider from DB: ${visionProvider}, fallback to ${base.visionProvider}`);
    } else {
        base.visionProvider = visionProvider;
    }

    // 校验 model：非法模型回退到该 provider 的默认模型
    const model = dbSettings.model || base.model;
    if (!isAllowedAIModel(base.provider, model)) {
        aiLogger.warn(`[AISettings] Rejected illegal/unknown model from DB: ${base.provider}/${model}, fallback to ${base.model}`);
    } else {
        base.model = model;
    }

    const visionModel = dbSettings.visionModel || base.visionModel;
    if (!isAllowedAIModel(base.visionProvider, visionModel)) {
        aiLogger.warn(`[AISettings] Rejected illegal/unknown visionModel from DB: ${base.visionProvider}/${visionModel}, fallback to ${base.visionModel}`);
    } else {
        base.visionModel = visionModel;
    }

    // 数值边界保护
    if (typeof dbSettings.maxTokens === "number" && dbSettings.maxTokens > 0 && dbSettings.maxTokens <= 8000) {
        base.maxTokens = dbSettings.maxTokens;
    }
    if (typeof dbSettings.temperature === "number" && dbSettings.temperature >= 0 && dbSettings.temperature <= 2) {
        base.temperature = dbSettings.temperature;
    }
    if (typeof dbSettings.textSystemPrompt === "string" && dbSettings.textSystemPrompt.length > 0) {
        base.textSystemPrompt = dbSettings.textSystemPrompt;
    }
    if (typeof dbSettings.visionSystemPrompt === "string") {
        base.visionSystemPrompt = dbSettings.visionSystemPrompt;
    }

    // apiKeys 永远只从环境变量读取，禁止 DB 覆盖
    base.apiKeys = DEFAULT_AI_SETTINGS.apiKeys;

    return base;
}

/**
 * 获取 AI 配置 (带缓存)
 */
export async function getAISettings(): Promise<AISettings> {
    const now = Date.now();
    if (cachedSettings && now - cacheTimestamp < CACHE_TTL) {
        return cachedSettings;
    }

    try {
        // 尝试从数据库读取
        const setting = await prisma.setting.findUnique({
            where: { key: "advisor_ai_settings" },
        });

        if (setting?.value) {
            const dbSettings = setting.value as Partial<AISettings>;
            cachedSettings = sanitizeAISettings(dbSettings);
        } else {
            cachedSettings = { ...DEFAULT_AI_SETTINGS };
        }

        cacheTimestamp = now;
        return cachedSettings;
    } catch (error) {
        // DB 不可用时使用最便宜的默认配置（qwen-turbo 全天最低价）
        aiLogger.warn("Failed to fetch settings from DB, using cost-optimized defaults", { error: String(error) });
        return {
            ...DEFAULT_AI_SETTINGS,
            provider: "qwen",
            model: "qwen-turbo",
        };
    }
}

/**
 * 检查 AI 功能是否全局启用
 * 优先检查环境变量，其次使用默认策略
 *
 * 注意：为避免后台偷跑费用，此处不再周期性调用 models.list() 验证 Key。
 * 只要配置了非空 Key 即认为启用；真正的无效 Key 会在首次 chat.completions.create()
 * 调用时快速失败，并在上层被错误处理捕获。
 */
export async function isAIEnabled(): Promise<boolean> {
    // 1. 环境变量强制开关 (最高优先级)
    if (process.env.AI_ENABLED === "false") {
        return false;
    }

    // 2. 检查是否有有效的 API Key 配置
    const settings = await getAISettings();
    const provider = settings.provider || "qwen";
    const keys = getApiKeysForProvider(provider, settings);

    // 仅判断 Key 是否存在，不再调用服务商接口做可用性探测
    return keys.length > 0;
}

/**
 * 获取特定服务商的所有 API Keys (支持逗号分隔)
 */
export function getApiKeysForProvider(provider: AIProvider, settings: AISettings): string[] {
    const keyMap = settings.apiKeys || {};
    const rawKeys = keyMap[provider];

    if (!rawKeys) return [];

    return rawKeys
        .split(/[,;\n]+/)
        .map(k => k.trim())
        .filter(k => k.length > 0);
}

// ============================================================================
// 客户端工厂
// ============================================================================

export function getProviderConfig(provider: AIProvider) {
    // 这是一个同步辅助函数，主要用于获取 BaseURL 等静态信息
    // 实际的 Key 获取应该使用 getApiKeysForProvider
    switch (provider) {
        case "deepseek":
            return { baseUrl: process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1" };
        case "qwen":
            return { baseUrl: process.env.QWEN_API_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1" };
        default:
            return { baseUrl: "" };
    }
}

export function createOpenAIClient(provider: AIProvider, apiKey: string) {
    const config = getProviderConfig(provider);
    return new OpenAI({
        apiKey: apiKey,
        baseURL: config.baseUrl,
    });
}

// ============================================================================
// 核心生成逻辑
// ============================================================================

/**
 * 文本生成 (支持服务商降级 & 多 Key 轮询)
 * @param userId - 可选登录用户ID，用于单用户每日AI调用硬限流
 */
export async function generateText(
    systemPrompt: string,
    userPrompt: string,
    preferredProvider?: AIProvider,
    signal?: AbortSignal,
    userId?: string | null
): Promise<string> {
    // 如果外部 signal 已 abort，直接抛出
    if (signal?.aborted) {
        throw new Error("Request cancelled by client.");
    }

    // 全局预算熔断检查（text 类型预估 ¥0.10 覆盖 qwen-plus/deepseek 上限场景）
    const budgetStatus = await checkAIBudget("text", 0.10, userId);
    if (!budgetStatus.allowed) {
        throw new Error(`[AIBudget] ${budgetStatus.reason}`);
    }

    try {
        const settings = await getAISettings();
        const primaryProvider = preferredProvider || settings.provider || "qwen";
        const primaryModel = settings.model;

        // 构建尝试队列
        const fallbackList = PROVIDER_FALLBACK_CHAIN[primaryProvider] || [];
        const providerQueue = [primaryProvider, ...fallbackList];

        aiLogger.info(`AI Execution Plan: ${providerQueue.join(" -> ")}`);

        let lastError: Error | null = null;

        for (const provider of providerQueue) {
            const model = provider === primaryProvider ? primaryModel : getModelForProvider(provider);

            try {
                const result = await callProviderWithRetry(provider as AIProvider, model, systemPrompt, userPrompt, settings, signal);
                aiLogger.info(`AI Generation Success using provider: ${provider}`);
                return result;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                if (error.name === 'AbortError' || signal?.aborted) {
                    throw new Error("Request cancelled by client.");
                }
                aiLogger.warn(`Provider ${provider} failed: ${error.message}. Switching to next...`);
                lastError = error;
                continue;
            }
        }

        throw lastError || new Error("All AI providers failed.");
    } finally {
        // 安全释放：确保即使异常路径未调 recordAIUsage 也能释放预留
        releasePendingReservation("text", 0.10);
    }
}

/**
 * 单个服务商调用 (含 Key 轮询)
 */
async function callProviderWithRetry(
    provider: AIProvider,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    settings: AISettings,
    signal?: AbortSignal
): Promise<string> {
    let apiKeys = getApiKeysForProvider(provider, settings);

    if (apiKeys.length === 0) {
        throw new Error(`No API keys found for provider: ${provider}`);
    }

    // 优先使用健康 key
    apiKeys = filterHealthyKeys(provider, apiKeys);
    if (apiKeys.length === 0) {
        aiLogger.warn(`All keys for ${provider} are in cooldown, trying anyway`);
        apiKeys = getApiKeysForProvider(provider, settings);
    }

    // Key 轮询（带指数退避 + key 健康管理）
    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        try {
            if (i > 0) aiLogger.info(`Retrying with key ${i + 1}/${apiKeys.length} for ${provider}`);
            const result = await callProviderInternal(provider, apiKey, model, systemPrompt, userPrompt, settings, signal);
            recordKeyResult(provider, apiKey, { success: true });
            return result;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            if (error.name === 'AbortError' || signal?.aborted) {
                throw error;
            }
            const status = error.status;
            const statusStr = String(error);
            const isAbort = error.name === 'AbortError' || signal?.aborted;
            const isAuth = status === 401 || status === 403 || statusStr.includes("401") || statusStr.includes("403");
            const isRateLimit = status === 429 || statusStr.includes("429");
            const isBadRequest = status === 400 || statusStr.includes("400");
            const isServerError = status && status >= 500;

            if (isAbort) {
                throw error;
            }

            // 记录 key 健康状态
            recordKeyResult(provider, apiKey, {
                success: false,
                isRateLimit,
                isAuthError: isAuth,
            });

            const isLastKey = i >= apiKeys.length - 1;
            // 明确的客户端错误（400）不重试；认证错误直接换 key；限流/服务端错误先退避再换 key
            if (isBadRequest || isLastKey) {
                throw error;
            }

            if (isRateLimit || isServerError) {
                const baseDelay = isRateLimit ? 1000 : 500;
                const maxDelay = isRateLimit ? 8000 : 4000;
                const delayMs = Math.min(baseDelay * Math.pow(2, i), maxDelay);
                aiLogger.warn(`Provider ${provider} returned ${isRateLimit ? '429' : '5xx'}, backing off ${delayMs}ms before next key`);
                await new Promise(r => setTimeout(r, delayMs));
                if (signal?.aborted) {
                    throw new Error("Request cancelled during backoff.");
                }
            }

            // 重试前轻量预算检查：在途预留过高时中止重试，防止并发风暴超支
            if (i > 0 && !isBudgetSafeForRetry("text")) {
                aiLogger.warn(`Text AI retry aborted: pending reservation approaching budget limit`);
                throw new Error(`[AIBudget] Text retry budget limit approaching, request rejected`);
            }

            continue; // 尝试下一个 Key
        }
    }
    throw new Error(`All keys failed for ${provider}`);
}

async function callProviderInternal(
    provider: AIProvider,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    settings: AISettings,
    signal?: AbortSignal
): Promise<string> {
    const serviceKey = `text-${provider}`;

    // 熔断器检查
    if (!circuitBreaker.allowRequest(serviceKey)) {
        throw new Error(`[CircuitBreaker] Text AI service ${provider} is temporarily unavailable (circuit open)`);
    }

    // 输入长度保护：防止超长 prompt 导致高额 token 费用或 413
    const MAX_TOTAL_PROMPT_CHARS = 12000;
    let safeUserPrompt = userPrompt;
    const totalPromptLength = systemPrompt.length + userPrompt.length;
    if (totalPromptLength > MAX_TOTAL_PROMPT_CHARS) {
        const maxUserChars = Math.max(1000, MAX_TOTAL_PROMPT_CHARS - systemPrompt.length);
        safeUserPrompt = userPrompt.slice(0, maxUserChars) + "\n\n[提示：输入内容过长，已截断以控制成本]";
        aiLogger.warn(`Prompt truncated: ${totalPromptLength} -> ${systemPrompt.length + safeUserPrompt.length} chars`);
    }

    aiLogger.info(`Calling AI: ${provider} (${model})`, { promptLength: safeUserPrompt.length, totalPromptLength });

    // 合并外部 signal 和内部 timeout 的辅助函数
    function createMergedAbortController(timeoutMs: number) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const onExternalAbort = () => {
            clearTimeout(timeout);
            controller.abort();
        };
        if (signal) {
            signal.addEventListener('abort', onExternalAbort);
        }
        return {
            controller,
            cleanup: () => {
                clearTimeout(timeout);
                if (signal) {
                    signal.removeEventListener('abort', onExternalAbort);
                }
            }
        };
    }

    // OpenAI 兼容接口 (DeepSeek, Qwen)
    // 合并外部 abort signal 和内部 30s 超时，防止 SDK 无限挂起
    const { controller, cleanup } = createMergedAbortController(30000);
    const startedAt = Date.now();
    try {
        const client = createOpenAIClient(provider, apiKey);
        const completion = await client.chat.completions.create(
            {
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: safeUserPrompt }
                ],
                temperature: settings.temperature,
                max_tokens: Math.min(settings.maxTokens, 3000)
            },
            { signal: controller.signal }
        );
        // 记录 Token 消耗日志
        const usage = completion.usage;
        if (usage) {
            aiLogger.info(`[TokenUsage] Text AI (${provider}/${model})`, {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens,
                durationMs: Date.now() - startedAt,
                promptLength: systemPrompt.length + userPrompt.length,
            });
            // 持久化到数据库，用于成本审计与预算熔断
            await recordAIUsage({
                provider,
                model,
                requestType: "text",
                promptTokens: usage.prompt_tokens || 0,
                completionTokens: usage.completion_tokens || 0,
                totalTokens: usage.total_tokens || 0,
                durationMs: Date.now() - startedAt,
                success: true,
            });
        }
        // 记录成功到熔断器
        circuitBreaker.recordSuccess(serviceKey);
        return completion.choices[0]?.message?.content || "";
    } catch (err) {
        const e = err as Error & { name?: string };
        const isTimeout = e.name === 'AbortError' && !signal?.aborted;

        // 记录失败/超时调用（超时时服务商可能已处理并计费）
        await recordAIUsage({
            provider,
            model,
            requestType: "text",
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            durationMs: Date.now() - startedAt,
            success: false,
            errorCode: isTimeout ? "timeout" : e.message?.slice(0, 200),
        });

        // 客户端主动取消或内部超时不应计入熔断器失败统计
        if (!isTimeout && !signal?.aborted) {
            circuitBreaker.recordFailure(serviceKey);
        }
        throw err;
    } finally {
        cleanup();
    }
}

// ============================================================================
// 工具函数
// ============================================================================

function getModelForProvider(provider: string): string {
    // 降级时使用该 provider 最便宜的模型
    switch (provider) {
        case "deepseek": return "deepseek-chat";
        case "qwen": return "qwen-turbo"; // qwen-turbo 比 qwen-plus 便宜 8 倍
        default: return "deepseek-chat";
    }
}

export function extractJson(content: string) {
    return extractJsonFromResponse(content);
}

/**
 * 降级分析 (当 AI 服务不可用时)
 * 使用规则引擎生成近似结果
 */
export function fallbackAnalysis(answers: QuestionnaireAnswers): FaceAnalysisResult {
    aiLogger.warn("Using fallback analysis (Rule Engine)");

    // 基础模板
    const result = getDefaultFaceAnalysisResult();

    // 1. 肤质推断
    result.skinType.type = answers.skinType || "combination";
    result.skinType.description = "根据您的问卷反馈，初步推测为" + (answers.skinType || "混合性") + "肌肤。";

    // 2. 关注点映射
    const concerns = identifyConcerns(answers);

    // 3. 维度调整
    concerns.forEach(c => {
        if (c === "wrinkles" || c === "aging") {
            result.dimensions.wrinkles.score = 65;
            result.dimensions.wrinkles.grade = "average";
            result.dimensions.wrinkles.details = "需关注细纹生成";
        }
        if (c === "acne") {
            result.dimensions.acne.score = 60;
            result.dimensions.acne.grade = "average";
            result.dimensions.waterOil.score = 60;
            result.dimensions.waterOil.grade = "average";
        }
        if (c === "dullness" || c === "spots") {
            result.dimensions.spots.score = 65;
            result.dimensions.radiance.score = 65;
        }
        if (c === "sensitivity") {
            result.dimensions.sensitivity.score = 60;
            result.dimensions.sensitivity.grade = "average";
            result.skinType.type = "sensitive";
        }
    });

    // 4. 水分推断
    result.hydration = {
        level: answers.skinType === "dry" ? "low" : "medium",
        description: answers.skinType === "dry" ? "肌肤水分含量偏低，需加强保湿" : "肌肤水分含量尚可，注意维持水油平衡"
    };

    // 5. 建议生成
    result.recommendations = [
        "保持良好的作息习惯",
        "注意防晒，避免紫外线损伤",
        "根据肤质选择适合的洁面产品",
        "如果是敏感肌，请避免使用刺激性成分"
    ];

    return result;
}


