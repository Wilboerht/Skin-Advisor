import { fetchWithCsrf } from "@/lib/fetch-client";
import {
    ALL_CONSENT_SCOPES,
    CONSENT_VERSION,
    type ConsentScope,
} from "@/lib/consent-constants";
import { getPrivacyConsentPayload } from "@/lib/consent-storage";

export interface ConsentApiState {
    version: string;
    granted: ConsentScope[];
    missing: ConsentScope[];
}

export async function fetchConsentState(): Promise<ConsentApiState | null> {
    try {
        const res = await fetchWithCsrf("/api/account/consent", { cache: "no-store" });
        if (!res.ok) return null;
        const body = await res.json();
        return body?.data ?? null;
    } catch {
        return null;
    }
}

export async function recordClientConsent(
    scopes: ConsentScope[] = ALL_CONSENT_SCOPES
): Promise<ConsentApiState | null> {
    try {
        const res = await fetchWithCsrf("/api/account/consent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                agreed: true,
                version: CONSENT_VERSION,
                scopes,
            }),
        });
        if (!res.ok) return null;
        const body = await res.json();
        return body?.data ?? null;
    } catch {
        return null;
    }
}

/**
 * 确保服务端已有同意记录。
 *
 * 只在本地存在显式同意记录时做一次迁移写入；没有本地同意时返回 false，
 * 由调用方引导用户重新阅读并同意，不能在分析流程里静默 `agreed: true`。
 */
export async function ensureClientConsent(
    scopes: ConsentScope[] = ALL_CONSENT_SCOPES
): Promise<boolean> {
    const state = await fetchConsentState();
    if (state && scopes.every((scope) => state.granted.includes(scope))) return true;

    const local = getPrivacyConsentPayload();
    if (!local?.consentedAt) return false;

    const recorded = await recordClientConsent(scopes);
    return !!recorded && scopes.every((scope) => recorded.granted.includes(scope));
}
