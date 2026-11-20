import prisma from "@/lib/prisma";
import {
    ALL_CONSENT_SCOPES,
    CONSENT_VERSION,
    isConsentScope,
    type ConsentScope,
} from "@/lib/consent-constants";
import { createSignedInternalApiHeaders } from "@/lib/internal-api";
import { hashConsentSubject } from "@/lib/privacy";
import { logger } from "@/lib/logger";
import type { ConsentEventDocument } from "@prisma/client";

export type { ConsentScope } from "@/lib/consent-constants";

export const CONSENT_EVIDENCE_RETENTION_YEARS = 3;

export function consentRetentionUntil(from: Date = new Date()): Date {
    const until = new Date(from);
    until.setFullYear(until.getFullYear() + CONSENT_EVIDENCE_RETENTION_YEARS);
    return until;
}

const CONSENT_EVENT_DOCUMENT: Record<ConsentScope, ConsentEventDocument> = {
    privacy: "PRIVACY",
    terms: "TERMS",
    face: "FACE",
    health: "HEALTH",
    ai: "AI",
};

const LEGAL_CONTENT_HASH_PATH = "/api/internal/legal/content-hash";
const LEGAL_CONTENT_HASH_CACHE_MS = 5 * 60 * 1000;
const contentHashCache = new Map<string, { value: string; expiresAt: number }>();

/**
 * 从主站读取“已发布完整政策正文”的 contentHash，而不是测肤摘要的哈希。
 * 主站不可用时返回 null，不阻断用户同意；版本号仍会记录。
 */
async function resolveContentHash(scope: ConsentScope): Promise<string | null> {
    if (scope !== "privacy" && scope !== "terms") return null;

    const requested = scope === "privacy" ? "PRIVACY" : "TERMS";
    const cached = contentHashCache.get(requested);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
        const query = `document=${requested}`;
        const signed = await createSignedInternalApiHeaders(
            "advisor",
            "GET",
            LEGAL_CONTENT_HASH_PATH,
            "",
            { query }
        );
        if (!signed) return null;

        const base = (process.env.OFFICIAL_API_URL || "https://nihplod.cn").replace(/\/+$/, "");
        const response = await fetch(`${base}${LEGAL_CONTENT_HASH_PATH}?${query}`, {
            headers: signed.headers,
            signal: AbortSignal.timeout(3000),
            cache: "no-store",
        });
        if (!response.ok) {
            logger.warn("[Consent] 主站政策哈希查询失败", { status: response.status });
            return null;
        }
        const json = (await response.json().catch(() => null)) as {
            success?: boolean;
            data?: { contentHash?: unknown };
        } | null;
        const value = json?.success && typeof json.data?.contentHash === "string"
            ? json.data.contentHash
            : null;
        if (value) {
            contentHashCache.set(requested, {
                value,
                expiresAt: Date.now() + LEGAL_CONTENT_HASH_CACHE_MS,
            });
        }
        return value;
    } catch (error) {
        logger.warn("[Consent] 主站政策哈希查询异常", { error: String(error) });
        return null;
    }
}

export interface ConsentState {
    version: string;
    granted: ConsentScope[];
    missing: ConsentScope[];
}

export async function getConsentState(userId: string): Promise<ConsentState> {
    const records = await prisma.consentRecord.findMany({
        where: {
            userId,
            version: CONSENT_VERSION,
            revokedAt: null,
        },
        select: { scope: true },
    });

    const granted = new Set(
        records
            .map((record) => record.scope)
            .filter(isConsentScope)
    );

    return {
        version: CONSENT_VERSION,
        granted: ALL_CONSENT_SCOPES.filter((scope) => granted.has(scope)),
        missing: ALL_CONSENT_SCOPES.filter((scope) => !granted.has(scope)),
    };
}

export async function hasConsent(
    userId: string,
    scopes: ConsentScope[] = ALL_CONSENT_SCOPES
): Promise<boolean> {
    const state = await getConsentState(userId);
    return scopes.every((scope) => state.granted.includes(scope));
}

export async function recordConsent(
    userId: string,
    scopes: ConsentScope[],
    ipHash?: string | null
): Promise<ConsentState> {
    const uniqueScopes = [...new Set(scopes)];
    const now = new Date();
    const contentHashes = new Map<ConsentScope, string | null>();
    await Promise.all(
        uniqueScopes.map(async (scope) => {
            contentHashes.set(scope, await resolveContentHash(scope));
        })
    );

    await prisma.$transaction([
        prisma.user.update({
            where: { id: userId },
            data: {
                privacyConsentAt: now,
                privacyConsentVersion: CONSENT_VERSION,
            },
        }),
        ...uniqueScopes.map((scope) =>
            prisma.consentRecord.upsert({
                where: {
                    userId_scope_version: {
                        userId,
                        scope,
                        version: CONSENT_VERSION,
                    },
                },
                update: {
                    grantedAt: now,
                    revokedAt: null,
                    ipHash: ipHash ?? null,
                },
                create: {
                    userId,
                    scope,
                    version: CONSENT_VERSION,
                    grantedAt: now,
                    ipHash: ipHash ?? null,
                },
            })
        ),
        ...uniqueScopes.map((scope) =>
            prisma.consentEvent.create({
                data: {
                    userId,
                    subjectType: "USER",
                    subjectHash: hashConsentSubject(userId),
                    project: "SKIN",
                    document: CONSENT_EVENT_DOCUMENT[scope],
                    version: CONSENT_VERSION,
                    contentHash: contentHashes.get(scope) ?? null,
                    action: "GRANTED",
                    channel: "skin",
                    occurredAt: now,
                    ipHash: ipHash ?? null,
                },
            })
        ),
    ]);

    return getConsentState(userId);
}

export async function revokeConsent(userId: string, scopes: ConsentScope[]): Promise<void> {
    const uniqueScopes = [...new Set(scopes)];
    const now = new Date();

    await prisma.$transaction(async (tx) => {
        const existing = await tx.consentRecord.findMany({
            where: {
                userId,
                scope: { in: uniqueScopes },
                version: CONSENT_VERSION,
                revokedAt: null,
            },
            select: { scope: true },
        });

        await tx.consentRecord.updateMany({
            where: {
                userId,
                scope: { in: uniqueScopes },
                version: CONSENT_VERSION,
                revokedAt: null,
            },
            data: { revokedAt: now },
        });

        if (existing.length > 0) {
            await tx.consentEvent.createMany({
                data: existing.map(({ scope }) => ({
                    userId,
                    subjectType: "USER",
                    subjectHash: hashConsentSubject(userId),
                    project: "SKIN",
                    document: CONSENT_EVENT_DOCUMENT[scope as ConsentScope],
                    version: CONSENT_VERSION,
                    contentHash: null,
                    action: "REVOKED",
                    channel: "skin",
                    occurredAt: now,
                })),
            });
        }

        if (uniqueScopes.includes("privacy")) {
            await tx.user.update({
                where: { id: userId },
                data: {
                    privacyConsentAt: null,
                    privacyConsentVersion: null,
                },
            });
        }
    });
}
