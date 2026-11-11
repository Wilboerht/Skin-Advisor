/**
 * 轻量告警：通过 ALERT_WEBHOOK_URL 推送到飞书/企微/通用 webhook。
 * 未配置时静默跳过；同一 key 在冷却窗口内只发一次，避免告警风暴。
 */

import { aiLogger } from "@/lib/logger";

export type AlertLevel = "info" | "warn" | "error";

interface AlertInput {
    key: string;
    level: AlertLevel;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
}

const DEDUPE_MS = 30 * 60 * 1000;
const sent = new Map<string, number>();

export async function sendAlert(input: AlertInput): Promise<boolean> {
    const url = process.env.ALERT_WEBHOOK_URL?.trim();
    if (!url) return false;

    const now = Date.now();
    const last = sent.get(input.key);
    if (last && now - last < DEDUPE_MS) return false;
    sent.set(input.key, now);

    const text = `[${input.level.toUpperCase()}] ${input.title}\n${input.message}`;
    const format = (process.env.ALERT_WEBHOOK_FORMAT || "generic").toLowerCase();
    const body = format === "feishu"
        ? { msg_type: "text", content: { text } }
        : { text };

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
            aiLogger.warn("[Alerting] webhook returned non-ok", { status: res.status, key: input.key });
            return false;
        }
        return true;
    } catch (error) {
        aiLogger.warn("[Alerting] webhook failed", { error: String(error), key: input.key });
        return false;
    }
}
