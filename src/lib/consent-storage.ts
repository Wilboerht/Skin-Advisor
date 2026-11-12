/**
 * 本地隐私同意记录读写（纯存储，不依赖 UI 组件）。
 * 供扫脸页/分析 hook/问卷页使用，避免把整个 PrivacyConsent UI 打进首屏包。
 */

import { STORAGE_KEYS } from "@/lib/storage-keys";
import { CONSENT_VERSION } from "@/lib/consent-constants";

export interface LocalPrivacyConsent {
    version?: string;
    consentedAt?: string;
    /** 本机同意记录归属账号；账号变化后旧记录不得复用 */
    ownerId?: string;
}

function currentOwnerId(): string {
    try {
        return localStorage.getItem(STORAGE_KEYS.ADVISOR_CLIENT_OWNER) || "";
    } catch {
        return "";
    }
}

function matchesOwner(data: LocalPrivacyConsent): boolean {
    const owner = currentOwnerId();
    // 旧版本记录没有 ownerId：有当前账号标记时视为不可复用，强制重新同意
    return !!owner && data.ownerId === owner;
}

export function hasPrivacyConsent(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.ADVISOR_PRIVACY_CONSENT);
        if (!raw) return false;
        const data = JSON.parse(raw) as LocalPrivacyConsent;
        return data.version === CONSENT_VERSION && !!data.consentedAt && matchesOwner(data);
    } catch {
        return false;
    }
}

export function getPrivacyConsentPayload(): LocalPrivacyConsent | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.ADVISOR_PRIVACY_CONSENT);
        if (!raw) return null;
        const data = JSON.parse(raw) as LocalPrivacyConsent;
        return matchesOwner(data) ? data : null;
    } catch {
        return null;
    }
}

/** 显式同意后写入（只有用户点击同意才调用，不在分析流程中自动授予） */
export function savePrivacyConsent(): LocalPrivacyConsent | null {
    if (typeof window === "undefined") return null;
    const payload: LocalPrivacyConsent = {
        version: CONSENT_VERSION,
        consentedAt: new Date().toISOString(),
        ownerId: currentOwnerId(),
    };
    try {
        localStorage.setItem(STORAGE_KEYS.ADVISOR_PRIVACY_CONSENT, JSON.stringify(payload));
        return payload;
    } catch {
        return null;
    }
}
