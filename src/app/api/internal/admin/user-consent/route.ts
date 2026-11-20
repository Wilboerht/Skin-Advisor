import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { guardInternalUserRequest } from "@/lib/internal-guard";
import { CONSENT_VERSION } from "@/lib/consent-constants";
import { logger } from "@/lib/logger";

export const maxDuration = 15;

/**
 * 内部接口：主站管理端查询测肤用户授权状态。
 * userId 为主站 SSO sub，也是测肤 User.id。
 */
export async function GET(request: NextRequest) {
    const guard = await guardInternalUserRequest(request, {
        scope: "admin-user-consent",
        maxRequests: 120,
    });
    if (guard.error) return guard.error;

    const userId = guard.userId;

    try {
        const [user, records, events] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    privacyConsentAt: true,
                    privacyConsentVersion: true,
                },
            }),
            prisma.consentRecord.findMany({
                where: { userId },
                orderBy: { grantedAt: "desc" },
                select: {
                    scope: true,
                    version: true,
                    grantedAt: true,
                    revokedAt: true,
                },
            }),
            prisma.consentEvent.findMany({
                where: { userId },
                orderBy: { occurredAt: "desc" },
                take: 50,
                select: {
                    action: true,
                    document: true,
                    version: true,
                    channel: true,
                    occurredAt: true,
                },
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                currentVersion: CONSENT_VERSION,
                user: user
                    ? {
                          privacyConsentAt: user.privacyConsentAt?.toISOString() ?? null,
                          privacyConsentVersion: user.privacyConsentVersion,
                      }
                    : null,
                records: records.map((record) => ({
                    scope: record.scope,
                    version: record.version,
                    grantedAt: record.grantedAt.toISOString(),
                    revokedAt: record.revokedAt?.toISOString() ?? null,
                })),
                events: events.map((event) => ({
                    action: event.action,
                    document: event.document,
                    version: event.version,
                    channel: event.channel,
                    occurredAt: event.occurredAt.toISOString(),
                })),
            },
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        logger.error("[internal/admin/user-consent] failed", {
            userId,
            error: String(error),
        });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
