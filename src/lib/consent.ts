import prisma from "@/lib/prisma";
import {
    ALL_CONSENT_SCOPES,
    CONSENT_VERSION,
    isConsentScope,
    type ConsentScope,
} from "@/lib/consent-constants";

export type { ConsentScope } from "@/lib/consent-constants";

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
    ]);

    return getConsentState(userId);
}

export async function revokeConsent(userId: string, scopes: ConsentScope[]): Promise<void> {
    const uniqueScopes = [...new Set(scopes)];
    const now = new Date();

    await prisma.$transaction([
        prisma.consentRecord.updateMany({
            where: {
                userId,
                scope: { in: uniqueScopes },
                version: CONSENT_VERSION,
                revokedAt: null,
            },
            data: { revokedAt: now },
        }),
        ...(uniqueScopes.includes("privacy")
            ? [
                  prisma.user.update({
                      where: { id: userId },
                      data: {
                          privacyConsentAt: null,
                          privacyConsentVersion: null,
                      },
                  }),
              ]
            : []),
    ]);
}
