import {
    getAISettings,
    getApiKeysForProvider,
    createOpenAIClient,
    isAllowedAIModel,
    PROVIDER_FALLBACK_CHAIN,
    type AIProvider
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
    extractJsonFromResponse,
    VisionAnalysisOutputSchema,
} from "./advisor-utils";
import { enforceZoneAdviceIngredients } from "./ingredient-guard";

export interface VisionImage {
    data: string; // base64 string (data:image/...)
    angle?: string;
}

// 辅助函数：延迟
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** 单个分数夹取到 0-100 整数；非数值返回 undefined（保持字段缺失而不是写脏值） */
function clampScore(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    return Math.min(100, Math.max(0, Math.round(value)));
}

const ZONE_NUMERIC_KEYS = ["oil", "texture", "wrinkles", "spots", "redness", "darkCircles", "firmness", "contour"] as const;

/**
 * 视觉结果分数校准（原地修改）：
 * - 十维/子分/区域指标统一夹取 0-100；
 * - overallScore 由十维分数均值重算，保证与雷达图/证据链一致（模型自报综合分不参与）；
 * - 肌龄夹取 10-80 的合理区间。
 */
function calibrateVisionScores(data: Record<string, unknown>): void {
    const dims = data.dimensions as Record<string, { score?: unknown; blackheads?: unknown; pimples?: unknown }> | undefined;

    if (dims && typeof dims === "object") {
        const scores: number[] = [];
        for (const dim of Object.values(dims)) {
            if (!dim || typeof dim !== "object") continue;
            const score = clampScore(dim.score);
            if (score !== undefined) {
                dim.score = score;
                scores.push(score);
            }
            if (dim.blackheads !== undefined) dim.blackheads = clampScore(dim.blackheads);
            if (dim.pimples !== undefined) dim.pimples = clampScore(dim.pimples);
        }
        if (scores.length > 0) {
            data.overallScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
        }
    }

    const zones = data.zoneAnalysis as Record<string, Record<string, unknown>> | undefined;
    if (zones && typeof zones === "object") {
        for (const zone of Object.values(zones)) {
            if (!zone || typeof zone !== "object") continue;
            for (const key of ZONE_NUMERIC_KEYS) {
                if (zone[key] !== undefined) zone[key] = clampScore(zone[key]);
            }
        }
    }

    const skinAge = data.skinAge as { estimated?: unknown } | undefined;
    if (skinAge && typeof skinAge === "object" && typeof skinAge.estimated === "number" && Number.isFinite(skinAge.estimated)) {
        skinAge.estimated = Math.min(80, Math.max(10, Math.round(skinAge.estimated)));
    }
}

/**
 * 性别枚举容错（原地修改）：模型可能返回 男/Male/未知 等值导致 zod 枚举校验失败。
 * 映射常见写法；无法识别的删除该可选字段（gender 非必填），避免整份分析作废。
 */
function normalizeVisionGender(data: Record<string, unknown>): void {
    const gender = data.gender as { value?: unknown } | undefined;
    if (!gender || typeof gender !== "object" || gender.value === undefined) return;
    const v = String(gender.value).trim().toLowerCase();
    if (v === "male" || v === "男" || v === "男性") gender.value = "male";
    else if (v === "female" || v === "女" || v === "女性") gender.value = "female";
    else delete data.gender;
}

/** 递归删除 null 值（模型在拒绝/不确定时会把字段写成 null，zod optional 不接受 null） */
function stripNulls(value: unknown): unknown {
    if (Array.isArray(value)) return value.filter(v => v !== null).map(stripNulls);
    if (value && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (v === null) continue;
            out[k] = stripNulls(v);
        }
        return out;
    }
    return value;
}

const VISION_ZONE_KEYS = ["forehead", "tZone", "leftCheek", "rightCheek", "eyeArea", "jawline"] as const;

/**
 * 视觉输出归一化（校验前）：
 * - 剔除 null 字段（deepseek 非人脸拒绝时会把整个维度块写成 null）；
 * - skinType.type 缺失时删除整个可选字段；
 * - zoneAnalysis 存在时补齐六个分区键（各分区字段本身可空）；
 * - 性别枚举归一。
 */
export function normalizeVisionOutput(data: Record<string, unknown>): Record<string, unknown> {
    const cleaned = stripNulls(data) as Record<string, unknown>;

    const skinType = cleaned.skinType as { type?: unknown } | undefined;
    if (skinType && typeof skinType === "object" && typeof skinType.type !== "string") {
        delete cleaned.skinType;
    }

    const zones = cleaned.zoneAnalysis as Record<string, unknown> | undefined;
    if (zones && typeof zones === "object") {
        for (const key of VISION_ZONE_KEYS) {
            if (!zones[key] || typeof zones[key] !== "object") zones[key] = {};
        }
    }

    normalizeVisionGender(cleaned);
    return cleaned;
}

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
    _defaultSystemPrompt: string, // 调用方构建的视觉 system prompt（基础 + 动态条件化），为空时按 provider 兜底
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
        // 单用户日限与全局预算分开标记：用户侧限额走 [AIUserLimit]（路由返回 429+原因），
        // 全局预算/在途预留走 [AIBudget]（路由 503 平台口径）
        const tag = budgetStatus.userLimited ? "[AIUserLimit]" : "[AIBudget]";
        throw new Error(`${tag} ${budgetStatus.reason}`);
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

            // 视觉 system prompt 由调用方（face-analyze）构建：基础常量 + 会员深度分析 + 拍摄状态条件化，
            // 均为代码内受控内容；默认按 provider 兜底。不再支持 DB 覆盖，避免覆盖时静默丢失动态说明
            const systemPrompt = _defaultSystemPrompt || getVisionSystemPrompt(provider);

            aiLogger.info(`Starting Vision Analysis: ${provider} (${model})`, { imageCount: images.length, isFallback: !isPrimary });

            try {
                const result = await tryVisionProviderWithKeys(
                    provider,
                    model,
                    images,
                    systemPrompt,
                    finalUserPrompt,
                    signal,
                    userId,
                    sessionId
                );
                return result;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                // 内部 visionTimeout 已在底层包装为 [Timeout] 错误（走普通失败/fallback 路径），
                // 此处的 AbortError 只剩外部 signal（客户端断开/路由超时）一种来源
                if (error.name === 'AbortError' || signal?.aborted) {
                    throw new Error("Vision request cancelled by client.");
                }
                // 预算/限额类错误与 provider 无关，换下一个 provider 也必然失败，直接上抛
                if (typeof error?.message === 'string' &&
                    (error.message.startsWith('[AIBudget]') || error.message.startsWith('[AIUserLimit]'))) {
                    throw error;
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

            // 解析与 Zod 结构验证（抽取 JSON → null/枚举/分区归一 → 校验）
            let rawJson: Record<string, unknown>;
            try {
                rawJson = extractJsonFromResponse<Record<string, unknown>>(result);
            } catch (extractErr) {
                // 提取失败多为输出截断/空响应，记录首尾便于定位
                aiLogger.warn(`Vision JSON extraction failed (${provider}/${model})`, {
                    contentLen: result.length,
                    contentHead: result.slice(0, 150),
                    contentTail: result.slice(-150),
                });
                // [Parse] 前缀：模型输出问题而非 Key 故障，catch 里据此直抛（不轮换 Key、不记 Key 健康）
                const extractMsg = extractErr instanceof Error ? extractErr.message : String(extractErr);
                throw new Error(`[Parse] ${extractMsg}`);
            }
            const parsed = VisionAnalysisOutputSchema.safeParse(normalizeVisionOutput(rawJson));
            if (!parsed.success) {
                aiLogger.warn(`Vision schema validation failed (${provider}/${model})`, {
                    issues: parsed.error.message.slice(0, 500),
                    contentHead: result.slice(0, 200),
                });
                throw new Error(`[Parse] AI response schema validation failed: ${parsed.error.message}`);
            }
            const jsonData = parsed.data;

            // 分数校准：0-100 夹取 + 综合评分由十维均值重算（模型自报综合分常与维度矛盾）
            calibrateVisionScores(jsonData as unknown as Record<string, unknown>);

            // 硬保证：zoneAnalysis advice 禁用成分扫描（prompt 软约束的兜底）。
            // 命中时该区域 advice 降级为安全通用文案并告警，禁用成分文本不出库
            const ingredientViolations = enforceZoneAdviceIngredients(jsonData.zoneAnalysis);
            if (ingredientViolations.length > 0) {
                aiLogger.warn(
                    `[IngredientGuard] 禁用成分命中 ${ingredientViolations.length} 处（session=${sessionId ?? "unknown"}）：` +
                    ingredientViolations.map((v) => `${v.zone}/${v.keyword}`).join(", ")
                );
            }

            // 优先检查 validation 拦截状态（非真人/翻拍/遮挡等）
            const validation = jsonData.validation as { isValid?: boolean; message?: string } | undefined;
            if (validation && validation.isValid === false) {
                const reason = validation.message || "图片未通过验证";
                throw new Error(`[Validation] ${reason}`);
            }

            // 成功也记录 Key 健康：复位连续失败计数/冷却，避免单次抖动把 Key 永久打入冷宫
            recordKeyResult(provider, apiKey, { success: true });
            return jsonData; // 成功返回

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            if (error.name === 'AbortError' || signal?.aborted) {
                throw new Error("Vision request cancelled by client.");
            }
            // 业务校验失败（非真人/翻拍等）与 Key 健康无关：
            // 直接抛出，不轮换 Key、不重复计费、不误标 Key 不健康
            if (typeof error?.message === 'string' && error.message.startsWith('[Validation]')) {
                throw error;
            }
            // JSON 提取/schema 校验失败是模型输出问题，同样与 Key 健康无关：
            // 直抛给 analyzeImages 走 provider fallback，不在本 provider 内空转轮换 Key
            if (typeof error?.message === 'string' && error.message.startsWith('[Parse]')) {
                throw error;
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

    // 合并外部 signal + 内部 70s 超时，防止 SDK 无限挂起。
    // 路由 90s / 队列 15s：70s + 15s = 85s，给外层 abort 和客户端留出缓冲。
    // 历史上 qwen-vl-max 4图实测 48-50s；2026-10 起仅传正脸单图，70s 覆盖单图生成。
    const visionTimeout = new AbortController();
    const visionTimeoutId = setTimeout(() => visionTimeout.abort(), 70000);
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
                // 十维 + 六分区完整 JSON 实测可达 2500+ tokens；篇幅纪律后约 1.5-2K，
                // 5000 上限对冗长输出留 2 倍余量（截断的 JSON 无法解析，表现为提取失败）
                max_tokens: 5000,
                temperature: 0.2,
                // deepseek-flash 默认推理强度 high：思考链会吃掉 max_tokens 预算，
                // 导致正文 JSON 截断（生产实测 Failed to extract valid JSON）。
                // 结构化抽取任务不需要推理，压到 low
                ...(provider === "deepseek" ? { reasoning_effort: "low" as const } : {}),
            },
            { signal: mergedSignal }
        );
    } catch (err) {
        cleanupTimeout();
        // 区分 abort 来源：外部 signal（客户端断开/路由超时）已 abort 才算客户端取消；
        // 仅内部 visionTimeout 触发时是 provider 侧超时
        const e = err as Error & { name?: string };
        // 以内部 controller 是否 abort 为准，SDK 可能把超时包装成普通 Error
        const isTimeout = visionTimeout.signal.aborted && !signal?.aborted;

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

        // 客户端主动取消不计入熔断；内部超时属于 provider 可用性问题，需要计入
        if (!signal?.aborted) {
            circuitBreaker.recordFailure(serviceKey);
        }
        // 内部超时包装为 [Timeout] 错误上抛：让上层走普通的 provider 失败/重试/回滚路径，
        // 避免被误判为 "Vision request cancelled by client."（499 不回滚额度）
        if (isTimeout) {
            throw new Error(`[Timeout] Vision AI 响应超时（${provider}/${model}）`);
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

    // finish_reason=length 表示输出被 max_tokens 截断——JSON 必然不完整，
    // 记录日志便于发现输出预算不足（正常应为 stop）
    const finishReason = response.choices[0]?.finish_reason;
    if (finishReason === "length") {
        aiLogger.warn(`Vision output truncated by max_tokens (${provider}/${model})`, {
            completionTokens: response.usage?.completion_tokens,
        });
    }

    return response.choices[0]?.message?.content || "";
}

// 辅助：获取默认视觉模型
function getDefaultVisionModel(provider: AIProvider): string {
    // env 覆盖只在该 provider 白名单内生效——否则 qwen 的模型名会泄漏到
    // deepseek 兜底链（deepseek/qwen3-vl-plus 这类错位组合），白名单拒绝后
    // "回退"又拿到同一个非法值，日志误导且配上 key 后必然 404
    const envModel = process.env.AI_VISION_MODEL?.trim();
    if (envModel && isAllowedAIModel(provider, envModel)) return envModel;
    switch (provider) {
        case "qwen": return "qwen3-vl-plus";
        case "deepseek": return "deepseek-flash";
        default: return "deepseek-flash";
    }
}

// 辅助：按 provider 返回预设视觉 Prompt（调用方未传时的兜底；不再支持 DB 覆盖）
function getVisionSystemPrompt(provider: AIProvider): string {
    if (provider === "qwen") return QWEN_VISION_PROMPT || "";

    // 默认 (DeepSeek 等 OpenAI 兼容接口)
    return VISION_ANALYSIS_SYSTEM_PROMPT;
}

