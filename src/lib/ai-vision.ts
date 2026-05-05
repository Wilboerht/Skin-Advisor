import {
    getAISettings,
    getApiKeysForProvider,
    getProviderConfig,
    createOpenAIClient,
    type AIProvider,
    type AISettings
} from "./ai";
import { aiLogger } from "./logger";
import {
    VISION_ANALYSIS_SYSTEM_PROMPT,
    CLAUDE_VISION_PROMPT,
    QWEN_VISION_PROMPT
} from "@/config/ai-prompts";
import { extractJsonFromResponse } from "./advisor-utils";

export interface VisionImage {
    data: string; // base64 string (data:image/...)
    angle?: string;
}

const RETRY_DELAY_MS = 1000;

// 辅助函数：延迟
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 视觉分析主函数 (支持多 Key 轮询)
 */
export async function analyzeImages(
    images: VisionImage[],
    _defaultSystemPrompt: string, // 保留参数兼容，但内部优先用配置
    userPrompt: string,
    _defaultProvider: AIProvider = "openai"
) {
    // 1. 获取配置
    const settings = await getAISettings();
    // 优先使用数据库配置的 provider，如果没有则回退到传入参数或默认值
    const provider = (settings.visionProvider || _defaultProvider) as AIProvider;
    const model = settings.visionModel || getDefaultVisionModel(provider);

    // 获取 prompt (优先数据库配置)
    const systemPrompt = getVisionSystemPrompt(provider, settings) || _defaultSystemPrompt;

    aiLogger.info(`Starting Vision Analysis: ${provider} (${model})`, { imageCount: images.length });

    // 2. 准备 Prompt 上下文
    let finalUserPrompt = userPrompt;
    if (images.length > 1) {
        const angles = images.map(i => i.angle || 'unknown').join(', ');
        finalUserPrompt += `\n\n我提供了${images.length}张照片，分别是：${angles}。请综合分析所有照片。`;
    }

    // 3. 多 Key 轮询机制
    const apiKeys = getApiKeysForProvider(provider, settings);
    if (apiKeys.length === 0) {
        throw new Error(`No API keys found for vision provider: ${provider}`);
    }

    let lastError: Error | null = null;

    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];

        // 每个 Key 最多重试 2 次 (网络抖动)
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                if (attempt > 1) await delay(RETRY_DELAY_MS * attempt);
                if (i > 0 || attempt > 1) aiLogger.warn(`Vision Retry: Key ${i + 1}, Attempt ${attempt}`);

                const result = await callVisionAPI(provider, apiKey, model, images, systemPrompt, finalUserPrompt);

                // 解析与验证
                const jsonData = extractJsonFromResponse<any>(result);
                if (!jsonData) throw new Error("Failed to parse JSON from Vision API");

                // 简单的结构验证
                if (!jsonData.dimensions && !jsonData.faceAnalysis && !jsonData.skinType) {
                    throw new Error("AI response structure missing critical fields");
                }

                return jsonData; // 成功返回

            } catch (error: any) {
                lastError = error;
                aiLogger.warn(`Vision Error (${provider}): ${error.message}`);

                // 速率限制或认证错误 -> 换 Key
                const isAuthOrRate = error.status === 401 || error.status === 429 || String(error).includes("429");
                if (isAuthOrRate) {
                    break; // 跳出 attempt 循环，进入下一个 Key
                }
                // 其他错误 (如 500) 继续重试当前 Key
            }
        }
    }

    throw lastError || new Error("Vision analysis failed after exhausting all keys.");
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
    userPrompt: string
): Promise<string> {

    if (provider === "anthropic") {
        return callClaudeVision(apiKey, model, images, systemPrompt, userPrompt);
    }

    if (provider === "qwen") {
        // 通义千问 VL 特殊处理
        return callOpenAICompatibleVision(provider, apiKey, model, images, systemPrompt, userPrompt);
    }

    if (provider === "gemini") {
        return callGeminiVision(apiKey, model, images, systemPrompt, userPrompt);
    }

    // Default: OpenAI Compatible
    return callOpenAICompatibleVision(provider, apiKey, model, images, systemPrompt, userPrompt);
}

async function callClaudeVision(
    apiKey: string,
    model: string,
    images: VisionImage[],
    systemPrompt: string,
    userPrompt: string
) {
    const config = getProviderConfig("anthropic");

    const imageContents = images.map(img => {
        const matches = img.data.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) throw new Error("Invalid image format");
        return {
            type: "image",
            source: {
                type: "base64",
                media_type: matches[1],
                data: matches[2]
            }
        };
    });

    // Claude 将 system prompt 放在 user message 里效果往往更好，或者使用 system 字段
    // 这里我们把专门的 Vision Prompt 拼接到 user message
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(config.baseUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
            model: model || "claude-3-5-sonnet-20240620",
            max_tokens: 2500,
            messages: [
                {
                    role: "user",
                    content: [
                        ...imageContents,
                        { type: "text", text: `${systemPrompt}\n\n${userPrompt}` }
                    ]
                }
            ]
        }),
        signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic Vision Error: ${res.status} - ${err}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || "";
}

async function callOpenAICompatibleVision(
    provider: AIProvider,
    apiKey: string,
    model: string,
    images: VisionImage[],
    systemPrompt: string,
    userPrompt: string
) {
    const client = createOpenAIClient(provider, apiKey);

    const content: any[] = [
        { type: "text", text: userPrompt }
    ];

    images.forEach(img => {
        // Ensure data URI format
        let url = img.data;
        if (!url.startsWith("http") && !url.startsWith("data:")) {
            url = `data:image/jpeg;base64,${url}`;
        }

        // Qwen specific handling: If data URI is too long, it might fail.
        // But without OSS, we have no choice but to try.
        // Some adapters strip 'data:image/jpeg;base64,' but standard OpenAI requires it.

        content.push({
            type: "image_url",
            image_url: {
                url: url,
                // detail: "auto" // Default to auto
            },
        });
    });

    const response = await client.chat.completions.create({
        model: model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content },
        ],
        max_tokens: 2500,
        temperature: 0.2,
    });

    return response.choices[0]?.message?.content || "";
}

async function callGeminiVision(
    apiKey: string,
    model: string,
    images: VisionImage[],
    systemPrompt: string,
    userPrompt: string
) {
    const config = getProviderConfig("gemini");
    const targetModel = model || "gemini-1.5-flash";
    const url = `${config.baseUrl}/models/${targetModel}:generateContent?key=${apiKey}`;

    const parts: any[] = [
        { text: `${systemPrompt}\n\n${userPrompt}` }
    ];

    images.forEach(img => {
        const matches = img.data.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
            parts.push({
                inline_data: {
                    mime_type: matches[1], // e.g., image/jpeg
                    data: matches[2]       // raw base64
                }
            });
        }
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: parts }],
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 2048
            }
        }),
        signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini Vision Error: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// 辅助：获取默认视觉模型
function getDefaultVisionModel(provider: AIProvider): string {
    switch (provider) {
        case "qwen": return "qwen-vl-max";
        case "anthropic": return "claude-3-5-sonnet-20240620";
        case "openai": return "gpt-4o";
        case "gemini": return "gemini-1.5-flash";
        default: return "gpt-4o";
    }
}

// 辅助：获取视觉专用 Prompt
function getVisionSystemPrompt(provider: AIProvider, settings: AISettings): string {
    // 如果数据库配了 visionSystemPrompt，优先使用
    if (settings.visionSystemPrompt) return settings.visionSystemPrompt;

    // 否则根据 active provider 返回预设
    if (provider === "anthropic") return CLAUDE_VISION_PROMPT || "";
    if (provider === "qwen") return QWEN_VISION_PROMPT || "";

    // 默认
    return VISION_ANALYSIS_SYSTEM_PROMPT;
}
// ============================================================================
// 全能分析 (Vision + Text Combined)
// ============================================================================

export async function analyzeComprehensiveMultimodal(
    images: VisionImage[],
    userAnswersContext: string,
    productsContext: string,
    _defaultProvider: AIProvider = "openai"
) {
    const settings = await getAISettings();
    // 允许配置 overriding，否则用 settings.visionProvider 作为“主多模态模型”
    const provider = (settings.visionProvider || _defaultProvider) as AIProvider;
    const model = settings.visionModel || getDefaultVisionModel(provider);

    // Prompt
    const { COMPREHENSIVE_ANALYSIS_SYSTEM_PROMPT } = await import("@/config/ai-prompts");
    const systemPrompt = COMPREHENSIVE_ANALYSIS_SYSTEM_PROMPT;

    // User Prompt Construction
    let userPrompt = `请根据以下信息生成完整分析报告：\n\n${userAnswersContext}\n\n可用产品库:\n${productsContext}`;

    // 如果有图片
    if (images.length > 0) {
        const angles = images.map(i => i.angle || 'unknown').join(', ');
        userPrompt += `\n\n我提供了${images.length}张照片 (${angles})。请务必结合照片进行面部分析。`;
    } else {
        // Fallback if no images (純文本模式, though this function implies multimodal)
        userPrompt += `\n\n(注意：用户未上传照片，请根据问卷数据进行估算，并在 faceAnalysis 中注明 validation.isValid=false)`;
    }

    aiLogger.info(`Starting Comprehensive Multimodal Analysis: ${provider} (${model})`);

    // Reuse existing call logic but with different prompt/context
    const apiKeys = getApiKeysForProvider(provider, settings);
    if (apiKeys.length === 0) throw new Error(`No API keys for ${provider}`);

    let lastError: Error | null = null;
    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        try {
            if (i > 0) aiLogger.warn(`Multimodal Retry: Key ${i + 1}`);

            const result = await callVisionAPI(provider, apiKey, model, images, systemPrompt, userPrompt);
            const json = extractJsonFromResponse<any>(result);
            if (!json) throw new Error("Failed to parse comprehensive JSON");
            return json;

        } catch (e: any) {
            lastError = e;
            const isAuthOrRate = e.status === 401 || e.status === 429 || String(e).includes("429");
            if (!isAuthOrRate && i < apiKeys.length - 1) continue; // Try next key
            if (isAuthOrRate) continue; // Try next key
        }
    }
    throw lastError || new Error("Multimodal analysis failed");
}
