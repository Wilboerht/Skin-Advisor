import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose";
import prisma from "@/lib/prisma";
import { normalizeSsoAvatarUrl, SSO_BASE_URL } from "@/lib/sso-auth";
import { logger } from "@/lib/logger";

/**
 * 主站资料/会员变更 Webhook（服务端到服务端，无浏览器 Cookie）
 *
 * 主站（nihplod.cn，OIDC Provider）在用户资料或会员信息变更时推送：
 *   POST /api/auth/profile-webhook
 *   Body: { "event_token": "<RS256 JWT>" }
 *
 * event_token claims（与主站约定）：
 *   type: "profile_event"，iss = 主站 base url，aud = 本站 client_id，
 *   sub = 本站 User.id，exp ≤ 5 分钟，
 *   profile?: { nickname, avatar, birthday }，
 *   membership?: { level, totalSpent }（纯资料变更时可能缺省）
 *
 * 安全说明：
 * - membershipLevel / totalSpent 决定测肤四档配额（银卡加赠等），属于权限数据，
 *   必须通过主站 JWKS 验签 + iss/aud/exp 校验后才可信，绝不信任未验签的请求体。
 * - 若主站未配置 RS256 而降级为 HS256 签名，本站没有对应密钥，
 *   无法验证真伪，直接拒绝（401）并记日志，等待主站修复配置后重试。
 */

const SSO_ISSUER = SSO_BASE_URL.replace(/\/+$/, "");
const SSO_CLIENT_ID = process.env.NEXT_PUBLIC_SSO_CLIENT_ID;
const PROFILE_EVENT_TYPE = "profile_event";

// JWKS 首次拉取后由 jose 内部缓存（含自动刷新），无需自行实现缓存
const jwks = createRemoteJWKSet(new URL(`${SSO_ISSUER}/api/oauth/jwks`));

/** 验签失败 / claims 不符的统一响应（不区分具体原因，避免泄露校验细节） */
function unauthorized(reason: string, context?: Record<string, unknown>) {
    logger.warn(`[profile-webhook] 拒绝事件 token: ${reason}`, context);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
    // ---------- 解析请求体 ----------
    let eventToken: string;
    try {
        const body = (await request.json()) as Record<string, unknown>;
        if (typeof body?.event_token !== "string" || !body.event_token) {
            return NextResponse.json({ error: "Missing event_token" }, { status: 400 });
        }
        eventToken = body.event_token;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // ---------- 验签（签名 + iss + aud + exp 由 jwtVerify 一并校验） ----------
    // 主站降级为 HS256 时本站无共享密钥，直接拒绝（jwtVerify 也会失败，此处提前给出明确日志）
    let alg: string | undefined;
    try {
        alg = decodeProtectedHeader(eventToken).alg;
    } catch {
        return unauthorized("token 格式非法，无法解析 header");
    }
    if (alg !== "RS256") {
        return unauthorized(`非 RS256 签名（alg=${alg}），主站可能未配置 RS256 密钥对`);
    }
    if (!SSO_CLIENT_ID) {
        logger.error("[profile-webhook] NEXT_PUBLIC_SSO_CLIENT_ID 未配置");
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    let payload;
    try {
        ({ payload } = await jwtVerify(eventToken, jwks, {
            issuer: SSO_ISSUER,
            audience: SSO_CLIENT_ID,
        }));
    } catch (error) {
        return unauthorized("验签失败", { error: String(error) });
    }

    // ---------- claims 校验 ----------
    if (payload.type !== PROFILE_EVENT_TYPE) {
        return unauthorized(`type 不符: ${String(payload.type)}`);
    }
    const userId = payload.sub;
    if (!userId) {
        return unauthorized("缺少 sub");
    }

    // ---------- 更新本地用户 ----------
    // membershipLevel/totalSpent 来自验签后的 token，是除 userinfo 回源外
    // 唯一可信的会员数据写入口（见 src/lib/sso-auth.ts SsoProfileClaims 注释）
    try {
        const profile = (payload.profile ?? {}) as Record<string, unknown>;
        const membership = payload.membership as Record<string, unknown> | undefined;

        const data: Record<string, unknown> = { profileSyncedAt: new Date() };

        if (typeof profile.nickname === "string" && profile.nickname) {
            data.name = profile.nickname;
        }
        const avatarUrl = normalizeSsoAvatarUrl(
            typeof profile.avatar === "string" ? profile.avatar : undefined
        );
        if (avatarUrl) {
            data.avatarUrl = avatarUrl;
        }

        // membership 为可选字段：纯资料变更事件不携带，此时不动会员字段
        if (membership && typeof membership === "object") {
            if (typeof membership.level === "string" && membership.level) {
                data.membershipLevel = membership.level;
            }
            // totalSpent 仅接受有限 number，负值/小数兜底收敛（与 sso-auth 口径一致）
            if (typeof membership.totalSpent === "number" && Number.isFinite(membership.totalSpent)) {
                data.totalSpent = Math.max(0, Math.floor(membership.totalSpent));
            }
        }

        // updateMany 而非 update：用户可能尚未登录过子站（本地无记录），此时空操作返回 200，
        // 让主站视为投递成功（用户首次登录时会通过 userinfo 回源拿到最新资料）
        const result = await prisma.user.updateMany({ where: { id: userId }, data });
        if (result.count === 0) {
            logger.info("[profile-webhook] 本地无此用户，跳过更新", { userId });
        } else {
            logger.info("[profile-webhook] 用户资料已同步", {
                userId,
                hasMembership: Boolean(membership),
            });
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        // 返回 500 让主站按失败重试，避免资料静默丢失
        logger.error("[profile-webhook] 更新用户失败", { userId, error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
