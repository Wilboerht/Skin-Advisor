import OpenAI from "openai";
import prisma from "./prisma";
import { aiLogger } from "./logger";
import { TEXT_ANALYSIS_SYSTEM_PROMPT } from "@/config/ai-prompts";
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
const envProvider = process.env.AI_PROVIDER || "qwen";
const envVisionProvider = process.env.AI_VISION_PROVIDER || "qwen";

const DEFAULT_AI_SETTINGS: AISettings = {
    provider: envProvider as AIProvider,
    visionProvider: envVisionProvider as AIProvider,
    model: process.env.AI_MODEL || (envProvider === "qwen" ? "qwen-plus" : "deepseek-chat"),
    visionModel: process.env.AI_VISION_MODEL || (envVisionProvider === "qwen" ? "qwen-vl-max" : "deepseek-vl"),
    textSystemPrompt: TEXT_ANALYSIS_SYSTEM_PROMPT,
    visionSystemPrompt: "",
    maxTokens: 2000,
    temperature: 0.3,
    apiKeys: {
        deepseek: process.env.DEEPSEEK_API_KEY,
        qwen: process.env.QWEN_API_KEY,
    },
};

// 服务商降级链
const PROVIDER_FALLBACK_CHAIN: Record<string, AIProvider[]> = {
    deepseek: ["qwen"],
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
            // 合并默认值
            // 注意：apiKeys 仅允许来自环境变量，禁止从数据库覆盖，防止密钥泄露或被篡改
            cachedSettings = {
                ...DEFAULT_AI_SETTINGS,
                ...dbSettings,
                apiKeys: DEFAULT_AI_SETTINGS.apiKeys,
            };
        } else {
            cachedSettings = { ...DEFAULT_AI_SETTINGS };
        }

        cacheTimestamp = now;
        return cachedSettings;
    } catch (error) {
        aiLogger.warn("Failed to fetch settings from DB, using defaults", { error: String(error) });
        return { ...DEFAULT_AI_SETTINGS };
    }
}

/**
 * 检查 AI 功能是否全局启用
 * 优先检查环境变量，其次使用默认策略
 * 增加 API Key 可用性校验，避免配置了无效 Key 时误导用户进入分析流程
 */
let keyValidationCache: { valid: boolean; timestamp: number } | null = null;
const KEY_VALIDATION_CACHE_MS = 5 * 60 * 1000;

export async function isAIEnabled(): Promise<boolean> {
    // 1. 环境变量强制开关 (最高优先级)
    if (process.env.AI_ENABLED === "false") {
        return false;
    }

    // 2. 检查是否有有效的 API Key 配置
    const settings = await getAISettings();
    const provider = settings.provider || "qwen";
    const keys = getApiKeysForProvider(provider, settings);
    if (keys.length === 0) return false;

    // 3. 缓存有效期内直接返回上次校验结果，避免每次请求都 ping 服务商
    if (keyValidationCache && Date.now() - keyValidationCache.timestamp < KEY_VALIDATION_CACHE_MS) {
        return keyValidationCache.valid;
    }

    // 4. 轻量校验：尝试调用 models 列表验证 Key 可用性
    let valid = false;
    for (const apiKey of keys) {
        try {
            const client = createOpenAIClient(provider as AIProvider, apiKey);
            await client.models.list();
            valid = true;
            break;
        } catch (e) {
            aiLogger.warn(`AI key validation failed for ${provider}:`, { error: String(e) });
        }
    }

    keyValidationCache = { valid, timestamp: Date.now() };
    return valid;
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
 */
export async function generateText(
    systemPrompt: string,
    userPrompt: string,
    preferredProvider?: AIProvider,
    signal?: AbortSignal
): Promise<string> {
    // 如果外部 signal 已 abort，直接抛出
    if (signal?.aborted) {
        throw new Error("Request cancelled by client.");
    }

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
    const apiKeys = getApiKeysForProvider(provider, settings);

    if (apiKeys.length === 0) {
        throw new Error(`No API keys found for provider: ${provider}`);
    }

    // Key 轮询
    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        try {
            if (i > 0) aiLogger.info(`Retrying with key ${i + 1}/${apiKeys.length} for ${provider}`);
            return await callProviderInternal(provider, apiKey, model, systemPrompt, userPrompt, settings, signal);
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
            // 不重试明确的客户端错误（400），但重试认证/限流/服务器临时错误
            if (!isBadRequest && (isAuth || isRateLimit || isServerError) && i < apiKeys.length - 1) {
                continue; // 尝试下一个 Key
            }
            throw error; // 其他错误直接抛出
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
    aiLogger.info(`Calling AI: ${provider} (${model})`, { promptLength: userPrompt.length });

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
    try {
        const client = createOpenAIClient(provider, apiKey);
        const completion = await client.chat.completions.create(
            {
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: settings.temperature,
                max_tokens: settings.maxTokens
            },
            { signal: controller.signal }
        );
        return completion.choices[0]?.message?.content || "";
    } finally {
        cleanup();
    }
}

// ============================================================================
// 工具函数
// ============================================================================

function getModelForProvider(provider: string): string {
    // 简单映射默认模型
    switch (provider) {
        case "deepseek": return "deepseek-chat";
        case "qwen": return "qwen-plus";
        default: return "deepseek-chat";
    }
}

export function extractJson(content: string) {
    return extractJsonFromResponse(content);
}

// ============================================================================
// AI 分析业务逻辑
// ============================================================================

/**
 * 纯文本问卷 AI 分析
 */
export async function analyzeWithAI(
    answers: QuestionnaireAnswers,
    userPrompt: string,
    signal?: AbortSignal
): Promise<FaceAnalysisResult> {
    try {
        aiLogger.info("Starting AI Analysis (Text Only)");

        const resultText = await generateText(
            TEXT_ANALYSIS_SYSTEM_PROMPT,
            userPrompt,
            undefined,
            signal
        );

        const result = extractJsonFromResponse<FaceAnalysisResult>(resultText);

        if (!result || !result.skinType) {
            throw new Error("Invalid AI analysis result structure");
        }

        return result;
    } catch (error) {
        aiLogger.error("AI Analysis Failed", { error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
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


