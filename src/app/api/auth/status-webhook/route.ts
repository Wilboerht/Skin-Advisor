import { createHash, createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revokeAllLocalRefreshTokens } from "@/lib/auth";
import { UserRole, isDisabledUser, isValidUserRole } from "@/lib/permissions";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const SIGNATURE_HEADER = "x-webhook-signature";
const TIMESTAMP_TOLERANCE_SEC = 300;
const DISABLED_STATUSES = new Set(["SUSPENDED", "BANNED", "deleted"]);

function safeEqualHex(a: string, b: string): boolean {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length || bufA.length === 0) return false;
    return timingSafeEqual(bufA, bufB);
}

function verifySignature(rawBody: string, header: string | null, secret: string): { ok: boolean; reason?: string } {
    if (!header) return { ok: false, reason: "missing_signature_header" };
    const parts = Object.fromEntries(
        header.split(",").map((kv) => kv.split("=", 2) as [string, string])
    );
    const timestamp = Number(parts.t);
    const signature = parts.v1;
    if (!Number.isFinite(timestamp) || !signature) {
        return { ok: false, reason: "malformed_signature_header" };
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - timestamp) > TIMESTAMP_TOLERANCE_SEC) {
        return { ok: false, reason: "timestamp_out_of_window" };
    }
    const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
    if (!safeEqualHex(expected, signature)) {
        return { ok: false, reason: "signature_mismatch" };
    }
    return { ok: true };
}

function parseEventAt(value: unknown): Date | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(req: NextRequest) {
    const ip = getClientIP(req);
    const limit = await rateLimit(`status-webhook-ip-${ip}`, "default", { maxRequests: 60, windowMs: 60 * 1000 });
    if (!limit.success) {
        return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const secret = process.env.SSO_WEBHOOK_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            logger.error("[status-webhook] SSO_WEBHOOK_SECRET 未配置，拒绝处理");
            return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
        }
        logger.warn("[status-webhook] dev 环境未配置 SSO_WEBHOOK_SECRET，跳过验签（切勿用于生产）");
    }

    const rawBody = await req.text();
    if (secret) {
        const result = verifySignature(rawBody, req.headers.get(SIGNATURE_HEADER), secret);
        if (!result.ok) {
            logger.warn("[status-webhook] 验签失败", { reason: result.reason, ip });
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    let body: Record<string, unknown>;
    try {
        body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (body.event !== "account_status_change") {
        logger.warn("[status-webhook] 未知事件类型，忽略", { event: String(body.event) });
        return NextResponse.json({ ok: true });
    }

    const userId = typeof body.sub === "string" ? body.sub : "";
    const newStatus = typeof body.new_status === "string" ? body.new_status : "";
    const eventAt = parseEventAt(body.timestamp);
    if (!userId || !newStatus || !eventAt) {
        return NextResponse.json({ error: "Missing sub, new_status or valid timestamp" }, { status: 400 });
    }

    const isDisable = DISABLED_STATUSES.has(newStatus);
    const isRestore = newStatus === "ACTIVE";
    if (!isDisable && !isRestore) {
        logger.warn("[status-webhook] 未知状态值，忽略", { userId, newStatus });
        return NextResponse.json({ ok: true });
    }

    const providedEventId = body.event_id ?? body.eventId ?? body.id;
    const eventId = typeof providedEventId === "string" && providedEventId
        ? `provided:${providedEventId}`
        : createHash("sha256").update(rawBody).digest("hex");

    try {
        const outcome = await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { id: true, role: true, previousRole: true, lastStatusEventAt: true },
            });
            if (!user) {
                logger.info("[status-webhook] 本地无此用户，跳过", { userId, newStatus });
                return "missing" as const;
            }
            if (user.lastStatusEventAt && user.lastStatusEventAt >= eventAt) {
                logger.info("[status-webhook] 忽略重复或过期事件", { userId, newStatus, eventAt });
                return "stale" as const;
            }

            await tx.statusWebhookEvent.create({
                data: { id: eventId, userId, eventAt, newStatus },
            });

            if (isDisable) {
                if (isDisabledUser(user.role)) {
                    await tx.user.update({
                        where: { id: userId },
                        data: { lastStatusEventAt: eventAt },
                    });
                    return "disabled" as const;
                }
                await tx.user.update({
                    where: { id: userId },
                    data: {
                        role: UserRole.DISABLED,
                        previousRole: user.role,
                        tokenVersion: { increment: 1 },
                        lastStatusEventAt: eventAt,
                    },
                });
                return "disabled" as const;
            }

            const restoredRole = isDisabledUser(user.role)
                ? user.previousRole && isValidUserRole(user.previousRole) && !isDisabledUser(user.previousRole)
                    ? user.previousRole
                    : UserRole.USER
                : user.role;
            await tx.user.update({
                where: { id: userId },
                data: {
                    role: restoredRole,
                    previousRole: null,
                    lastStatusEventAt: eventAt,
                },
            });
            return "restored" as const;
        });

        if (isDisable && outcome === "disabled") {
            const revoked = await revokeAllLocalRefreshTokens(userId);
            logger.info("[status-webhook] 用户已本地禁用", { userId, newStatus, revokedRefreshTokens: revoked });
        } else if (outcome === "restored") {
            logger.info("[status-webhook] 用户状态已同步", { userId, newStatus });
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        if ((error as { code?: string })?.code === "P2002") {
            if (isDisable) {
                try {
                    await revokeAllLocalRefreshTokens(userId);
                } catch (revokeError) {
                    logger.error("[status-webhook] 重试撤销失败", { userId, error: String(revokeError) });
                    return NextResponse.json({ error: "Internal error" }, { status: 500 });
                }
            }
            return NextResponse.json({ ok: true });
        }
        logger.error("[status-webhook] 处理失败", { userId, newStatus, error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
