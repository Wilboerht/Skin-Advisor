/**
 * Admin AI 服务健康检查 API
 * GET /api/admin/ai-health
 * 返回 AI 预算使用率、熔断器状态等实时健康指标
 */

import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { getAIBudgetHealth } from "@/lib/ai-budget";
import { circuitBreaker } from "@/lib/circuit-breaker";

// 常见的服务标识键（对齐 ai.ts / ai-vision.ts / analyze route 的命名）
const SERVICE_KEYS = ["text-qwen", "text-deepseek", "vision-qwen", "vision-deepseek"];

export interface AIHealthResponse {
    budget: {
        dailyTokens: number;
        dailyCost: number;
        monthlyTokens: number;
        monthlyCost: number;
    };
    usage: {
        dailyTokens: number;
        dailyCost: number;
        monthlyTokens: number;
        monthlyCost: number;
    };
    dailyUsagePercent: number;
    monthlyUsagePercent: number;
    exhausted: boolean;
    exhaustedReason: string | null;
    circuits: Array<{
        service: string;
        state: string;
        failureCount: number;
        isBlocked: boolean;
    }>;
    /** 综合健康状态: healthy / warning / critical */
    status: "healthy" | "warning" | "critical";
}

export const GET = withAdminAuth(async () => {
    try {
        const budgetHealth = await getAIBudgetHealth();

        const circuits = SERVICE_KEYS.map((key) => {
            const s = circuitBreaker.getStatus(key);
            return {
                service: key,
                state: s.state,
                failureCount: s.failureCount,
                isBlocked: s.isBlocked,
            };
        });

        // 综合健康判定
        let status: "healthy" | "warning" | "critical" = "healthy";

        const blockedCircuits = circuits.filter((c) => c.isBlocked);
        if (budgetHealth.exhausted || blockedCircuits.length >= 2) {
            status = "critical";
        } else if (
            budgetHealth.dailyUsagePercent >= 80 ||
            budgetHealth.monthlyUsagePercent >= 80 ||
            blockedCircuits.length >= 1
        ) {
            status = "warning";
        }

        const result: AIHealthResponse = {
            budget: budgetHealth.budget,
            usage: budgetHealth.usage,
            dailyUsagePercent: budgetHealth.dailyUsagePercent,
            monthlyUsagePercent: budgetHealth.monthlyUsagePercent,
            exhausted: budgetHealth.exhausted,
            exhaustedReason: budgetHealth.exhaustedReason,
            circuits,
            status,
        };

        return NextResponse.json(result, {
            headers: {
                "Cache-Control": "no-cache, no-store, max-age=0",
            },
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
});
