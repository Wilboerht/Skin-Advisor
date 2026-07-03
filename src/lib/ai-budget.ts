/**
 * AI 预算/用量熔断与成本审计
 *
 * 功能：
 * 1. 按 provider/model 估算每次 AI 调用的费用
 * 2. 将 token 用量持久化到数据库（AIUsageLog）
 * 3. 提供全局日/月 token 与费用预算检查，达到阈值时熔断
 * 4. 提供单用户/单会话用量统计，用于异常告警
 */

import prisma from "./prisma";
import { aiLogger } from "./logger";
import type { AIProvider } from "./ai";

export type AIRequestType = "text" | "vision";

export interface AIUsageRecord {
    provider: AIProvider | string;
    model: string;
    requestType: AIRequestType;
    sessionId?: string | null;
    userId?: string | null;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    durationMs?: number;
    success?: boolean;
    errorCode?: string | null;
}

export interface AIBudgetStatus {
    allowed: boolean;
    reason?: string;
    dailyTokens: number;
    dailyCost: number;
    monthlyTokens: number;
    monthlyCost: number;
}

// ============================================================================
// 价格表（单位：人民币 / 1K tokens）
// 注意：价格为近似值，仅供参考与预算熔断；实际账单以云服务商为准。
// 未命中的模型按最贵一档估算，防止模型被切到高价模型后预算失效。
// ============================================================================

interface ModelPricing {
    input: number;   // 每 1K input tokens 人民币
    output: number;  // 每 1K output tokens 人民币
}

const DEFAULT_PRICING: ModelPricing = { input: 0.1, output: 0.3 };

const PRICING_TABLE: Record<string, Partial<Record<string, ModelPricing>>> = {
    qwen: {
        "qwen-turbo": { input: 0.0005, output: 0.002 },
        "qwen-plus": { input: 0.004, output: 0.012 },
        "qwen-max": { input: 0.04, output: 0.12 },
        "qwen-vl-max": { input: 0.02, output: 0.02 },
        "qwen-vl-plus": { input: 0.008, output: 0.008 },
    },
    deepseek: {
        // 2026年7月起峰谷定价：高峰 9-12 和 14-18 (北京时间) 价格为 2 倍
        "deepseek-chat": { input: 0.001, output: 0.002 },
        "deepseek-reasoner": { input: 0.004, output: 0.016 },
        "deepseek-vl": { input: 0.005, output: 0.005 },
    },
};

/**
 * 判断当前北京时间是否在 DeepSeek 高峰定价时段
 * 高峰: 每日 9:00-12:00 和 14:00-18:00 (北京时间)
 */
function isDeepSeekPeakHours(): boolean {
    const now = new Date();
    // UTC → 北京时间 (UTC+8)
    const beijingHour = now.getUTCHours() + 8;
    const hour = beijingHour >= 24 ? beijingHour - 24 : beijingHour;
    return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18);
}

/**
 * 估算单次调用的费用（人民币）
 * DeepSeek 峰谷定价：高峰时段 ×2
 */
export function estimateAICost(
    provider: string,
    model: string,
    promptTokens: number,
    completionTokens: number
): number {
    const normalizedProvider = provider.toLowerCase();
    const normalizedModel = model.toLowerCase();
    const providerTable = PRICING_TABLE[normalizedProvider] || {};
    const pricing = providerTable[normalizedModel] || DEFAULT_PRICING;

    const inputCost = (promptTokens / 1000) * pricing.input;
    const outputCost = (completionTokens / 1000) * pricing.output;

    // DeepSeek 峰谷定价：高峰时段 ×2
    let multiplier = 1;
    if (normalizedProvider === "deepseek" && isDeepSeekPeakHours()) {
        multiplier = 2;
    }

    return Math.round((inputCost + outputCost) * multiplier * 1_000_000) / 1_000_000;
}

/**
 * 获取模型价格信息（用于日志/告警）
 */
export function getModelPricing(provider: string, model: string): ModelPricing {
    const providerTable = PRICING_TABLE[provider.toLowerCase()] || {};
    return providerTable[model.toLowerCase()] || DEFAULT_PRICING;
}

// ============================================================================
// 预算读取
// ============================================================================

function parseBudgetEnv(value: string | undefined): number | null {
    if (!value) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
}

function getBudgetConfig() {
    return {
        dailyTokenBudget: parseBudgetEnv(process.env.AI_DAILY_TOKEN_BUDGET) ?? 500000,     // 默认 50万 tokens/天
        dailyCostBudget: parseBudgetEnv(process.env.AI_DAILY_COST_BUDGET_CNY) ?? 50,        // 默认 ¥50/天
        monthlyTokenBudget: parseBudgetEnv(process.env.AI_MONTHLY_TOKEN_BUDGET) ?? 10000000, // 默认 1000万 tokens/月
        monthlyCostBudget: parseBudgetEnv(process.env.AI_MONTHLY_COST_BUDGET_CNY) ?? 500,   // 默认 ¥500/月
    };
}

// ============================================================================
// 用量统计
// ============================================================================

function getDayBounds(date = new Date()) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
}

function getMonthBounds(date = new Date()) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { start, end };
}

async function getUsageStats(
    requestType?: AIRequestType
): Promise<{ dailyTokens: number; dailyCost: number; monthlyTokens: number; monthlyCost: number }> {
    const day = getDayBounds();
    const month = getMonthBounds();

    const whereBase: { requestType?: string; createdAt: { gte: Date; lt: Date } } = {
        createdAt: { gte: day.start, lt: day.end },
    };
    if (requestType) whereBase.requestType = requestType;

    const [dailyAgg, monthlyAgg] = await Promise.all([
        prisma.aIUsageLog.aggregate({
            where: whereBase,
            _sum: { totalTokens: true, estimatedCost: true },
        }),
        prisma.aIUsageLog.aggregate({
            where: {
                ...(requestType ? { requestType } : {}),
                createdAt: { gte: month.start, lt: month.end },
            },
            _sum: { totalTokens: true, estimatedCost: true },
        }),
    ]);

    return {
        dailyTokens: dailyAgg._sum.totalTokens || 0,
        dailyCost: dailyAgg._sum.estimatedCost || 0,
        monthlyTokens: monthlyAgg._sum.totalTokens || 0,
        monthlyCost: monthlyAgg._sum.estimatedCost || 0,
    };
}

// ============================================================================
// 预算检查
// ============================================================================

/**
 * 检查全局 AI 预算是否已超限
 * 在发起 AI 调用前调用，若超限则拒绝请求。
 */
export async function checkAIBudget(requestType?: AIRequestType): Promise<AIBudgetStatus> {
    const budget = getBudgetConfig();
    const stats = await getUsageStats(requestType);

    if (budget.dailyTokenBudget && stats.dailyTokens >= budget.dailyTokenBudget) {
        return { allowed: false, reason: "AI 日 token 预算已耗尽", ...stats };
    }
    if (budget.dailyCostBudget && stats.dailyCost >= budget.dailyCostBudget) {
        return { allowed: false, reason: "AI 日费用预算已耗尽", ...stats };
    }
    if (budget.monthlyTokenBudget && stats.monthlyTokens >= budget.monthlyTokenBudget) {
        return { allowed: false, reason: "AI 月 token 预算已耗尽", ...stats };
    }
    if (budget.monthlyCostBudget && stats.monthlyCost >= budget.monthlyCostBudget) {
        return { allowed: false, reason: "AI 月费用预算已耗尽", ...stats };
    }

    return { allowed: true, ...stats };
}

// ============================================================================
// 用量记录
// ============================================================================

/**
 * 持久化一次 AI 调用用量
 * 应在 AI 调用返回后（无论成功/失败）调用。
 */
export async function recordAIUsage(record: AIUsageRecord): Promise<void> {
    try {
        const estimatedCost = estimateAICost(
            record.provider,
            record.model,
            record.promptTokens,
            record.completionTokens
        );

        await prisma.aIUsageLog.create({
            data: {
                provider: record.provider,
                model: record.model,
                requestType: record.requestType,
                sessionId: record.sessionId || null,
                userId: record.userId || null,
                promptTokens: record.promptTokens,
                completionTokens: record.completionTokens,
                totalTokens: record.totalTokens,
                estimatedCost,
                durationMs: record.durationMs || 0,
                success: record.success ?? true,
                errorCode: record.errorCode || null,
            },
        });

        aiLogger.info(`[TokenUsage] ${record.requestType} recorded`, {
            provider: record.provider,
            model: record.model,
            promptTokens: record.promptTokens,
            completionTokens: record.completionTokens,
            totalTokens: record.totalTokens,
            estimatedCost,
        });
    } catch (e) {
        // 用量记录失败不应阻塞主流程，但需告警
        aiLogger.error("[TokenUsage] Failed to persist AI usage log", {
            error: e instanceof Error ? e.message : String(e),
            provider: record.provider,
            model: record.model,
        });
    }
}

// ============================================================================
// 单用户/单会话异常用量检测（供告警使用）
// ============================================================================

export interface AnomalyCheckResult {
    anomaly: boolean;
    message?: string;
    userDailyTokens?: number;
    userDailyCost?: number;
}

/**
 * 检查单个用户/会话在当日的用量是否异常突增
 */
export async function checkUserUsageAnomaly(
    userId: string | null | undefined,
    sessionId: string | null | undefined,
    thresholdTokens = 50_000,
    thresholdCost = 5
): Promise<AnomalyCheckResult> {
    const day = getDayBounds();
    const where: { createdAt: { gte: Date; lt: Date }; userId?: string; sessionId?: string } = {
        createdAt: { gte: day.start, lt: day.end },
    };
    if (userId) where.userId = userId;
    else if (sessionId) where.sessionId = sessionId;
    else return { anomaly: false };

    const agg = await prisma.aIUsageLog.aggregate({
        where,
        _sum: { totalTokens: true, estimatedCost: true },
    });

    const tokens = agg._sum.totalTokens || 0;
    const cost = agg._sum.estimatedCost || 0;

    if (tokens >= thresholdTokens || cost >= thresholdCost) {
        return {
            anomaly: true,
            message: `AI 用量异常：userId=${userId || "n/a"}, sessionId=${sessionId || "n/a"}, 日 token=${tokens}, 日 cost=${cost.toFixed(4)} CNY`,
            userDailyTokens: tokens,
            userDailyCost: cost,
        };
    }

    return { anomaly: false, userDailyTokens: tokens, userDailyCost: cost };
}
