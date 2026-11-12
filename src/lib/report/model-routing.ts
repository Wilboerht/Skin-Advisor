/**
 * 文本模型路由（默认关闭，通过环境变量启用）：
 * - 轻度/无问题报告 → AI_TEXT_FAST_MODEL（更快更便宜）
 * - 中重度问题 → AI_TEXT_STRONG_MODEL（更稳更细）
 * - 未配置或非法模型 → 回退 settings.model
 */

import { isAllowedAIModel, type AIProvider } from "@/lib/ai";
import type { ReportFinding } from "./types";

export interface RoutedTextModel {
    model?: string;
    reason: "disabled" | "fast" | "strong" | "fallback";
}

export function selectRoutedTextModel(
    provider: AIProvider,
    findings: ReportFinding[],
    env: Record<string, string | undefined> = process.env
): RoutedTextModel {
    if (env.AI_TEXT_ROUTING_ENABLED !== "true") return { reason: "disabled" };

    const hasSevereOrModerate = findings.some(
        (finding) => finding.severity === "severe" || finding.severity === "moderate"
    );
    const candidate = hasSevereOrModerate
        ? env.AI_TEXT_STRONG_MODEL
        : env.AI_TEXT_FAST_MODEL;

    if (!candidate) return { reason: "fallback" };
    if (!isAllowedAIModel(provider, candidate)) return { reason: "fallback" };
    return { model: candidate, reason: hasSevereOrModerate ? "strong" : "fast" };
}
