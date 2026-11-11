import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { getAISettings } from "@/lib/ai";
import { getAIBudgetHealth } from "@/lib/ai-budget";
import { circuitBreaker } from "@/lib/circuit-breaker";
import { sendAlert } from "@/lib/alerting";
import { logger } from "@/lib/logger";

export const maxDuration = 30;

function isAuthorized(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return process.env.NODE_ENV !== "production";
    const authHeader = request.headers.get("authorization");
    const provided = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const a = Buffer.from(provided);
    const b = Buffer.from(cronSecret);
    return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/**
 * AI 健康巡检 + 告警：
 * - 预算使用率 >80% / 预算耗尽
 * - 文本/视觉熔断器打开
 * - 超过 30 分钟仍处于 reserved 的孤儿预占
 * 由 crontab 定时调用：node scripts/run-cron.js /api/cron/ai-alerts
 */
export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const alerts: string[] = [];
    try {
        const [settings, budget] = await Promise.all([getAISettings(), getAIBudgetHealth()]);

        if (budget.exhausted) {
            alerts.push("budget_exhausted");
            await sendAlert({
                key: "ai-budget-exhausted",
                level: "error",
                title: "AI 预算已耗尽",
                message: budget.exhaustedReason || "全局 AI 预算已触发熔断，测肤报告生成会失败。",
                metadata: { usage: budget.usage, budget: budget.budget },
            });
        } else if (budget.dailyUsagePercent >= 80 || budget.monthlyUsagePercent >= 80) {
            alerts.push("budget_80");
            await sendAlert({
                key: "ai-budget-80",
                level: "warn",
                title: "AI 预算使用超过 80%",
                message: `日预算 ${budget.dailyUsagePercent}% / 月预算 ${budget.monthlyUsagePercent}%。`,
                metadata: { usage: budget.usage, budget: budget.budget },
            });
        }

        const textStatus = circuitBreaker.getStatus(`text-${settings.provider}`);
        const visionStatus = circuitBreaker.getStatus(`vision-${settings.visionProvider}`);
        if (textStatus.isBlocked || visionStatus.isBlocked) {
            alerts.push("circuit_open");
            await sendAlert({
                key: "ai-circuit-open",
                level: "error",
                title: "AI 服务熔断中",
                message: `文本 ${settings.provider}: ${textStatus.state}；视觉 ${settings.visionProvider}: ${visionStatus.state}。`,
                metadata: { textStatus, visionStatus },
            });
        }

        const staleBefore = new Date(Date.now() - 30 * 60 * 1000);
        const orphanReservations = await prisma.testRecord.count({
            where: { status: "reserved", leaseExpiresAt: { lt: staleBefore } },
        });
        if (orphanReservations > 0) {
            alerts.push("orphan_reservations");
            await sendAlert({
                key: "ai-orphan-reservations",
                level: "warn",
                title: "存在孤儿测肤预占",
                message: `超过 30 分钟仍未消费的 reserved TestRecord：${orphanReservations} 条。`,
                metadata: { orphanReservations },
            });
        }

        return NextResponse.json({
            success: true,
            alerts,
            budget: {
                dailyUsagePercent: budget.dailyUsagePercent,
                monthlyUsagePercent: budget.monthlyUsagePercent,
                exhausted: budget.exhausted,
            },
            circuit: { text: textStatus, vision: visionStatus },
            orphanReservations,
        });
    } catch (error) {
        logger.error("[Cron] ai-alerts failed", { error: String(error) });
        return NextResponse.json({ error: "巡检失败" }, { status: 500 });
    }
}
