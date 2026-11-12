/**
 * 分析会话的本地存储/锁/失败重试暂存（从 useAsyncAnalysis 拆出）。
 */

import { STORAGE_KEYS } from "@/lib/storage-keys";
import {
    parseFailedAnalysisRetry,
    serializeFailedAnalysisRetry,
    type FailedAnalysisRetry,
} from "@/lib/failed-analysis-retry";

// 覆盖视觉 95s + 文本 85s + 队列/网络开销；过短会让刷新后的恢复流程与在途分析并发。
const ANALYSIS_LOCK_TTL_MS = 300 * 1000;

export function clearAnalyzingSessionMarkers(): void {
    try {
        sessionStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYZING_SESSION_ID);
        sessionStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYZING_STARTED_AT);
        localStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYZING_SESSION_LOCAL);
    } catch { /* ignore */ }
}

export function readFailedAnalysisRetry(): FailedAnalysisRetry | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.ADVISOR_FAILED_ANALYSIS);
        if (!raw) return null;
        const parsed = parseFailedAnalysisRetry(raw);
        if (!parsed) {
            localStorage.removeItem(STORAGE_KEYS.ADVISOR_FAILED_ANALYSIS);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function writeFailedAnalysisRetry(sessionId: string, fingerprint: string): void {
    try {
        localStorage.setItem(
            STORAGE_KEYS.ADVISOR_FAILED_ANALYSIS,
            serializeFailedAnalysisRetry({ sessionId, startedAt: Date.now(), fingerprint })
        );
    } catch { /* ignore */ }
}

export function clearFailedAnalysisRetry(): void {
    try { localStorage.removeItem(STORAGE_KEYS.ADVISOR_FAILED_ANALYSIS); } catch { /* ignore */ }
}

export function acquireAnalysisLock(sessionId: string): boolean {
    try {
        const existing = sessionStorage.getItem(STORAGE_KEYS.ADVISOR_ANALYSIS_LOCK);
        const existingData = existing ? JSON.parse(existing) as { sessionId: string; startedAt: number } : null;
        if (existingData && existingData.sessionId !== sessionId && (Date.now() - existingData.startedAt) < ANALYSIS_LOCK_TTL_MS) {
            return false;
        }
        sessionStorage.setItem(STORAGE_KEYS.ADVISOR_ANALYSIS_LOCK, JSON.stringify({ sessionId, startedAt: Date.now() }));
        return true;
    } catch (e) {
        console.warn('sessionStorage access failed', e);
        return true;
    }
}

export function releaseAnalysisLock(): void {
    try {
        sessionStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYSIS_LOCK);
    } catch (e) {
        console.warn('sessionStorage access failed', e);
    }
}

export function getAnalysisLock(): { sessionId: string; startedAt: number } | null {
    try {
        const existing = sessionStorage.getItem(STORAGE_KEYS.ADVISOR_ANALYSIS_LOCK);
        if (!existing) return null;
        const data = JSON.parse(existing) as { sessionId: string; startedAt: number };
        if (Date.now() - data.startedAt >= ANALYSIS_LOCK_TTL_MS) {
            sessionStorage.removeItem(STORAGE_KEYS.ADVISOR_ANALYSIS_LOCK);
            return null;
        }
        return data;
    } catch (e) {
        console.warn('sessionStorage access failed', e);
        return null;
    }
}
