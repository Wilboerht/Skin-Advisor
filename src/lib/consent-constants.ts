export const CONSENT_VERSION = "2026-11-11";

// 客户端发版有窗口期：旧版本仍可能提交上一版权限文本版本。
// 服务端接收兼容版本，但统一按当前 CONSENT_VERSION 记录授权。
export const CONSENT_COMPATIBLE_VERSIONS = ["2026-11-11", "2026-10-27"] as const;

export const CONSENT_SCOPES = ["privacy", "face", "health", "ai"] as const;

export type ConsentScope = (typeof CONSENT_SCOPES)[number];

export const ALL_CONSENT_SCOPES: ConsentScope[] = [...CONSENT_SCOPES];

export function isConsentScope(value: unknown): value is ConsentScope {
    return typeof value === "string" && (CONSENT_SCOPES as readonly string[]).includes(value);
}
