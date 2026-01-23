import OpenAI from "openai";
import prisma from "./prisma";
import { aiLogger } from "./logger";
import { TEXT_ANALYSIS_SYSTEM_PROMPT } from "@/config/ai-prompts";
import {
    extractJsonFromResponse,
    getDefaultFaceAnalysisResult,
    determineSkinType,
    identifyConcerns,
    type QuestionnaireAnswers,
    type FaceAnalysisResult
} from "./advisor-utils";

// ============================================================================
// 类型定义
// ============================================================================

export interface SkincareStep {
    order: number;
    step: string;
    description: string;
    productName?: string;
}

export interface SkincareRoutine {
    morning: SkincareStep[];
    evening: SkincareStep[];
}


export type AIProvider = "openai" | "anthropic" | "qwen" | "deepseek" | "gemini";

export interface ApiKeys {
    openai?: string;
    deepseek?: string;
    qwen?: string;
    anthropic?: string;
    gemini?: string;
}

export interface AISettings {
    provider: AIProvider;
    visionProvider: AIProvider;
    model: string;
    visionModel: string;
    textSystemPrompt: string;
    visionSystemPrompt: string;
    chatSystemPrompt: string;
    maxTokens: number;
    temperature: number;
    apiKeys?: ApiKeys;
}

// 默认设置
const DEFAULT_AI_SETTINGS: AISettings = {
    provider: "deepseek",
    visionProvider: "openai",
    model: "deepseek-chat",
    visionModel: "gpt-4o",
    textSystemPrompt: TEXT_ANALYSIS_SYSTEM_PROMPT,
    visionSystemPrompt: "",
    chatSystemPrompt: "",
    maxTokens: 2000,
    temperature: 0.3,
    apiKeys: {
        openai: process.env.OPENAI_API_KEY,
        deepseek: process.env.DEEPSEEK_API_KEY,
        qwen: process.env.QWEN_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
        gemini: process.env.GEMINI_API_KEY,
    },
};

// 服务商降级链
const PROVIDER_FALLBACK_CHAIN: Record<string, AIProvider[]> = {
    deepseek: ["qwen", "openai", "gemini"],
    qwen: ["deepseek", "openai", "gemini"],
    openai: ["anthropic", "gemini", "deepseek"],
    anthropic: ["openai", "gemini", "deepseek"],
    gemini: ["openai", "anthropic", "deepseek"],
};

// 缓存配置
let cachedSettings: AISettings | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 60s

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
            cachedSettings = {
                ...DEFAULT_AI_SETTINGS,
                ...dbSettings,
                // 确保 API Keys 合并 (DB 优先，Env 兜底)
                apiKeys: {
                    ...DEFAULT_AI_SETTINGS.apiKeys,
                    ...(dbSettings.apiKeys || {}),
                },
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
 */
export async function isAIEnabled(): Promise<boolean> {
    // 1. 环境变量强制开关 (最高优先级)
    if (process.env.AI_ENABLED === "false") {
        return false;
    }

    // 2. 检查是否有有效的 API Key 配置
    // 如果没有任何 Key 可用，也可以视为 AI 不可用
    const settings = await getAISettings();
    const provider = settings.provider || "openai";
    const keys = getApiKeysForProvider(provider, settings);

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
        case "openai":
            return { baseUrl: process.env.OPENAI_API_URL || "https://api.openai.com/v1" };
        case "deepseek":
            return { baseUrl: process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1" };
        case "qwen":
            return { baseUrl: process.env.QWEN_API_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1" };
        case "anthropic":
            return { baseUrl: process.env.ANTHROPIC_API_URL || "https://api.anthropic.com/v1/messages" };
        case "gemini":
            return { baseUrl: process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com/v1beta" };
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
    preferredProvider?: AIProvider
): Promise<string> {
    const settings = await getAISettings();
    const primaryProvider = preferredProvider || settings.provider || "openai";
    const primaryModel = settings.model;

    // 构建尝试队列
    const fallbackList = PROVIDER_FALLBACK_CHAIN[primaryProvider] || [];
    const providerQueue = [primaryProvider, ...fallbackList];

    aiLogger.info(`AI Execution Plan: ${providerQueue.join(" -> ")}`);

    let lastError: Error | null = null;

    for (const provider of providerQueue) {
        const model = provider === primaryProvider ? primaryModel : getModelForProvider(provider, settings);

        try {
            const result = await callProviderWithRetry(provider as AIProvider, model, systemPrompt, userPrompt, settings);
            aiLogger.info(`AI Generation Success using provider: ${provider}`);
            return result;
        } catch (error: any) {
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
    settings: AISettings
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
            return await callProviderInternal(provider, apiKey, model, systemPrompt, userPrompt, settings);
        } catch (error: any) {
            const isAuthError = error.status === 401 || String(error).includes("401");
            const isRateLimit = error.status === 429 || String(error).includes("429");

            if ((isAuthError || isRateLimit) && i < apiKeys.length - 1) {
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
    settings: AISettings
): Promise<string> {
    aiLogger.info(`Calling AI: ${provider} (${model})`, { promptLength: userPrompt.length });

    // Anthropic 特殊处理
    if (provider === "anthropic") {
        const config = getProviderConfig("anthropic");
        const res = await fetch(config.baseUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: model || "claude-3-5-sonnet-20240620",
                max_tokens: settings.maxTokens,
                system: systemPrompt,
                messages: [{ role: "user", content: userPrompt }],
                temperature: settings.temperature
            })
        });

        if (!res.ok) throw new Error(`Anthropic Error: ${res.statusText}`);
        const data = await res.json();
        return data.content?.[0]?.text || "";
    }

    // Gemini 特殊处理 (简版)
    if (provider === "gemini") {
        const config = getProviderConfig("gemini");
        const url = `${config.baseUrl}/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: systemPrompt + "\n\n" + userPrompt }]
                }]
            })
        });
        if (!res.ok) throw new Error(`Gemini Error: ${res.statusText}`);
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    // OpenAI 兼容接口 (DeepSeek, Qwen, OpenAI)
    const client = createOpenAIClient(provider, apiKey);
    const completion = await client.chat.completions.create({
        model: model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: settings.temperature,
        max_tokens: settings.maxTokens
    });

    return completion.choices[0]?.message?.content || "";
}

// ============================================================================
// 工具函数
// ============================================================================

function getModelForProvider(provider: string, settings: AISettings): string {
    // 简单映射默认模型
    switch (provider) {
        case "deepseek": return "deepseek-chat";
        case "qwen": return "qwen-plus";
        case "gemini": return "gemini-1.5-flash";
        case "anthropic": return "claude-3-5-sonnet-20240620";
        case "openai": return "gpt-4o";
        default: return "gpt-3.5-turbo";
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
    userPrompt: string
): Promise<FaceAnalysisResult> {
    try {
        aiLogger.info("Starting AI Analysis (Text Only)");

        const resultText = await generateText(
            TEXT_ANALYSIS_SYSTEM_PROMPT,
            userPrompt
        );

        const result = extractJsonFromResponse<FaceAnalysisResult>(resultText);

        if (!result || !result.skinType) {
            throw new Error("Invalid AI analysis result structure");
        }

        return result;
    } catch (error) {
        aiLogger.error("AI Analysis Failed", error);
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
    const concernsMap: Record<string, string> = {
        aging: "抗衰老", wrinkles: "细纹", dullness: "暗沉",
        dryness: "干燥", acne: "痘痘", pores: "毛孔", sensitivity: "敏感"
    };

    result.priorityAreas = concerns;

    // 3. 维度调整
    concerns.forEach(c => {
        if (c === "wrinkles" || c === "aging") {
            result.dimensions.wrinkles.score = 65;
            result.dimensions.wrinkles.grade = "average";
            result.dimensions.wrinkles.details = "需关注细纹生成";
        }
        if (c === "acne" || c === "pores") {
            result.dimensions.acneRisk.score = 60;
            result.dimensions.acneRisk.grade = "average";
            result.dimensions.pores.score = 60;
            result.dimensions.pores.grade = "average";
        }
        if (c === "dullness" || c === "spots") {
            result.dimensions.spots.score = 65;
            result.dimensions.texture.score = 65;
        }
        if (c === "sensitivity") {
            result.dimensions.redAreas.score = 60;
            result.dimensions.redAreas.grade = "average";
            result.skinType.type = "sensitive";
        }
    });

    // 4. 水分推断
    result.hydration.level = answers.skinType === "dry" ? "low" : "medium";

    // 5. 建议生成
    result.recommendations = [
        "保持良好的作息习惯",
        "注意防晒，避免紫外线损伤",
        "根据肤质选择适合的洁面产品",
        "如果是敏感肌，请避免使用刺激性成分"
    ];

    return result;
}

/**
 * 生成护肤方案 (基于 NIHPLOD 产品线)
 */
export function generateSkincareRoutine(currentRoutine: string = "basic"): SkincareRoutine {
    // 基础方案 (晨间)
    const morningSteps: SkincareStep[] = [
        { order: 1, step: "洁面", description: "温和清洁，唤醒肌肤", productName: "云朵洁面慕斯" },
        { order: 2, step: "爽肤", description: "二次清洁，平衡酸碱", productName: "水杨酸调理水" },
        { order: 3, step: "面霜", description: "锁水保湿", productName: "深海海藻保湿霜" },
        { order: 4, step: "防晒", description: "抵御紫外线", productName: "轻透防晒霜" }
    ];

    // 基础方案 (晚间)
    const eveningSteps: SkincareStep[] = [
        { order: 1, step: "洁面", description: "深层清洁，卸除防晒", productName: "云朵洁面慕斯" },
        { order: 2, step: "爽肤", description: "补水保湿", productName: "水杨酸调理水" },
        { order: 3, step: "面霜", description: "夜间修护", productName: "逆龄面霜" }
    ];

    // 进阶调整 (Serum, Eye Cream etc)
    if (["advanced", "intermediate", "expert"].includes(currentRoutine)) {
        morningSteps.splice(2, 0, { order: 3, step: "精华", description: "抗氧提亮", productName: "光蕴焕活精华液" });
        morningSteps.forEach((s, i) => s.order = i + 1);

        eveningSteps.splice(2, 0, { order: 3, step: "精华", description: "紧致修护", productName: "修护紧致精华" });
        eveningSteps.splice(3, 0, { order: 4, step: "眼霜", description: "淡化细纹", productName: "视黄醇抗皱眼霜" });
        eveningSteps.forEach((s, i) => s.order = i + 1);
    }

    // 针对油性/痘痘肌调整
    // (这里可以根据 skinType 参数扩展，但目前只有 currentRoutine 参数)

    return {
        morning: morningSteps,
        evening: eveningSteps
    };
}
