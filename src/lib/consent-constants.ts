export const CONSENT_VERSION = "2026-10-27";

export const CONSENT_SCOPES = ["privacy", "face", "health", "ai"] as const;

export type ConsentScope = (typeof CONSENT_SCOPES)[number];

export const ALL_CONSENT_SCOPES: ConsentScope[] = [...CONSENT_SCOPES];

export function isConsentScope(value: unknown): value is ConsentScope {
    return typeof value === "string" && (CONSENT_SCOPES as readonly string[]).includes(value);
}
