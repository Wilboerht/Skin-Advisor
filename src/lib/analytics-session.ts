/**
 * 埋点与分析共用 sessionId（唯一事实源）。
 *
 * 旧实现用 timestamp-random 作为埋点会话，分析流程另生成 UUID，导致两条数据无法 join。
 * 现在统一使用 UUID，并在问卷提交时写入分析 session 存储键，后续 face-analyze/analyze
 * 与漏斗埋点落在同一条 AdvisorSession 上。
 */

export const ANALYTICS_SESSION_KEY = "advisor_session_id";

function newSessionId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    // 极端旧环境兜底：保持 UUID 形态，便于服务端 schema 通过
    const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
    return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-8${hex().slice(1)}-${hex()}${hex()}${hex()}`;
}

export function getOrCreateAnalyticsSessionId(): string {
    if (typeof window === "undefined") return "";
    try {
        const existing = sessionStorage.getItem(ANALYTICS_SESSION_KEY);
        if (existing) return existing;
        const created = newSessionId();
        sessionStorage.setItem(ANALYTICS_SESSION_KEY, created);
        return created;
    } catch {
        return "";
    }
}
