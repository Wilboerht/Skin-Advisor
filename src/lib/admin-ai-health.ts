import { getAIBudgetHealth } from "@/lib/ai-budget";
import { circuitBreaker } from "@/lib/circuit-breaker";

const SERVICE_KEYS = ["text-qwen", "text-deepseek", "vision-qwen", "vision-deepseek"];

export interface AdminAIHealth {
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
    status: "healthy" | "warning" | "critical";
}

/**
 * 子站 AI 预算/熔断健康摘要（admin ai-health 路由与主站控制中台内部接口共用）
 */
export async function getAdvisorAIHealth(): Promise<AdminAIHealth> {
    const budgetHealth = await getAIBudgetHealth();

    const circuits = SERVICE_KEYS.map((key) => {
        const status = circuitBreaker.getStatus(key);
        return {
            service: key,
            state: status.state,
            failureCount: status.failureCount,
            isBlocked: status.isBlocked,
        };
    });

    let status: AdminAIHealth["status"] = "healthy";
    const blockedCircuits = circuits.filter((item) => item.isBlocked);
    if (budgetHealth.exhausted || blockedCircuits.length >= 2) {
        status = "critical";
    } else if (
        budgetHealth.dailyUsagePercent >= 80 ||
        budgetHealth.monthlyUsagePercent >= 80 ||
        blockedCircuits.length >= 1
    ) {
        status = "warning";
    }

    return {
        budget: budgetHealth.budget,
        usage: budgetHealth.usage,
        dailyUsagePercent: budgetHealth.dailyUsagePercent,
        monthlyUsagePercent: budgetHealth.monthlyUsagePercent,
        exhausted: budgetHealth.exhausted,
        exhaustedReason: budgetHealth.exhaustedReason,
        circuits,
        status,
    };
}
