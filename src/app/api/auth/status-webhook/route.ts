import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revokeAllLocalRefreshTokens } from "@/lib/auth";
import { UserRole, isDisabledUser, isValidUserRole } from "@/lib/permissions";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

/**
 * 主站账号状态变更 Webhook 接收端（服务端到服务端，无浏览器 Cookie）
 *
 * 主站（nihplod.cn）在管理员封号/解冻/删除用户时推送（主站 src/lib/webhook.ts）：
 *   POST /api/auth/status-webhook
 *   Headers: X-Webhook-Signature: t=<unixSeconds>,v1=<hex>
 *   Body: { event: "account_status_change", sub, old_status, new_status, source, timestamp }
 *
 * 签名算法（与主站 signWebhookPayload 严格对齐）：
 *   v1 = HMAC-SHA256(secret, `${t}.${rawBody}`)  hex
 *   secret = SSO_WEBHOOK_SECRET（两端一致）；时间戳窗口 ±5 分钟防重放。
 *
 * 状态映射（主站 User.status 原始大写枚举；删除固定为小写 "deleted"）：
 *   SUSPENDED / BANNED / deleted → 本地禁用：role=disabled（原角色存 previousRole）、
 *     tokenVersion 递增（本地 JWT 立即失效）、撤销全部本地 refresh token；
 *   ACTIVE → 恢复：优先恢复 previousRole，缺失时回退普通 user，清空 previousRole。
 *
 * 幂等：本地无此用户 / 状态已一致时返回 200 空操作，让主站视为投递成功；
 * DB 异常返回 500，主站按指数退避重投（1s/4s/16s）。
 *
 * 前置条件：主站 SSO_STATUS_CHANGE_WEBHOOK_URLS 配置 {本站}/api/auth/status-webhook；
 * proxy.ts 已豁免本路径的 CSRF 校验（参照 profile-webhook）。
 */
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

/** 解析并校验 X-Webhook-Signature 头（t + v1），返回失败原因（仅用于日志） */
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

export async function POST(req: NextRequest) {
    const ip = getClientIP(req);
    const limit = await rateLimit(`status-webhook-ip-${ip}`, "default", { maxRequests: 60, windowMs: 60 * 1000 });
    if (!limit.success) {
        return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    // 签名密钥（与 ADVISOR_INTERNAL_SECRET 同口径）：production 未配置拒绝服务，dev 放行并告警
    const secret = process.env.SSO_WEBHOOK_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            logger.error("[status-webhook] SSO_WEBHOOK_SECRET 未配置，拒绝处理");
            return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
        }
        logger.warn("[status-webhook] dev 环境未配置 SSO_WEBHOOK_SECRET，跳过验签（切勿用于生产）");
    }

    // 签名覆盖原始报文，必须先读原文再 JSON.parse
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
        // 未知事件类型：非本端点处理范围，返回 200 避免主站无谓重投
        logger.warn("[status-webhook] 未知事件类型，忽略", { event: String(body.event) });
        return NextResponse.json({ ok: true });
    }
    const userId = typeof body.sub === "string" ? body.sub : "";
    const newStatus = typeof body.new_status === "string" ? body.new_status : "";
    if (!userId || !newStatus) {
        return NextResponse.json({ error: "Missing sub or new_status" }, { status: 400 });
    }

    const isDisable = DISABLED_STATUSES.has(newStatus);
    const isRestore = newStatus === "ACTIVE";
    if (!isDisable && !isRestore) {
        logger.warn("[status-webhook] 未知状态值，忽略", { userId, newStatus });
        return NextResponse.json({ ok: true });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true, previousRole: true },
        });
        // 幂等：本地无此用户（尚未登录过子站）视为投递成功
        if (!user) {
            logger.info("[status-webhook] 本地无此用户，跳过", { userId, newStatus });
            return NextResponse.json({ ok: true });
        }

        if (isDisable) {
            if (isDisabledUser(user.role)) {
                // 已是禁用态：幂等成功；仍兜底撤销 refresh token（可能上次禁用后新签发）
                await revokeAllLocalRefreshTokens(userId);
                return NextResponse.json({ ok: true });
            }
            await prisma.user.update({
                where: { id: userId },
                data: {
                    role: UserRole.DISABLED,
                    previousRole: user.role,
                    tokenVersion: { increment: 1 },
                },
            });
            const revoked = await revokeAllLocalRefreshTokens(userId);
            logger.info("[status-webhook] 用户已本地禁用", { userId, newStatus, revokedRefreshTokens: revoked });
            return NextResponse.json({ ok: true });
        }

        // ACTIVE：恢复角色。优先 previousRole；缺失/非法时回退普通 user（本站角色集仅 user/disabled）
        if (!isDisabledUser(user.role)) {
            return NextResponse.json({ ok: true }); // 未被禁用，幂等成功
        }
        const restoredRole = user.previousRole && isValidUserRole(user.previousRole) && !isDisabledUser(user.previousRole)
            ? user.previousRole
            : UserRole.USER;
        await prisma.user.update({
            where: { id: userId },
            data: { role: restoredRole, previousRole: null },
        });
        logger.info("[status-webhook] 用户已恢复", { userId, restoredRole });
        return NextResponse.json({ ok: true });
    } catch (error) {
        // 返回 500 让主站按失败重投，避免状态变更静默丢失
        logger.error("[status-webhook] 处理失败", { userId, newStatus, error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
