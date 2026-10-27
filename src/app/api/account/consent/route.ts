import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/sso-auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { getClientIP } from "@/lib/ratelimit";
import { hashIP } from "@/lib/privacy";
import { logger } from "@/lib/logger";
import {
    getConsentState,
    recordConsent,
    revokeConsent,
    type ConsentScope,
} from "@/lib/consent";
import { CONSENT_VERSION, isConsentScope } from "@/lib/consent-constants";

export const dynamic = "force-dynamic";

function parseScopes(value: unknown): ConsentScope[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter(isConsentScope))];
}

export async function GET(request: NextRequest) {
    const user = await getSessionUser(request);
    if (!user) return apiError(ErrorCode.UNAUTHORIZED, "请先登录", 401);

    try {
        const consent = await getConsentState(user.id);
        return apiSuccess(consent);
    } catch (error) {
        logger.error("[Consent] Failed to read consent state", { error: String(error), userId: user.id });
        return apiError(ErrorCode.INTERNAL_ERROR, "读取授权状态失败", 500);
    }
}

export async function POST(request: NextRequest) {
    const user = await getSessionUser(request);
    if (!user) return apiError(ErrorCode.UNAUTHORIZED, "请先登录", 401);

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return apiError(ErrorCode.VALIDATION_ERROR, "无效的请求体", 400);
    }

    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const scopes = parseScopes(record.scopes);
    const version = typeof record.version === "string" ? record.version : "";

    if (record.agreed !== true) {
        return apiError(ErrorCode.VALIDATION_ERROR, "请先确认授权", 400);
    }
    if (version !== CONSENT_VERSION) {
        return apiError(ErrorCode.CONFLICT, "授权版本已更新，请刷新后重试", 409);
    }
    if (scopes.length === 0) {
        return apiError(ErrorCode.VALIDATION_ERROR, "缺少授权范围", 400);
    }

    try {
        const consent = await recordConsent(user.id, scopes, hashIP(getClientIP(request)));
        return apiSuccess(consent);
    } catch (error) {
        logger.error("[Consent] Failed to record consent", { error: String(error), userId: user.id });
        return apiError(ErrorCode.INTERNAL_ERROR, "保存授权失败", 500);
    }
}

export async function DELETE(request: NextRequest) {
    const user = await getSessionUser(request);
    if (!user) return apiError(ErrorCode.UNAUTHORIZED, "请先登录", 401);

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return apiError(ErrorCode.VALIDATION_ERROR, "无效的请求体", 400);
    }

    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const scopes = parseScopes(record.scopes);
    if (scopes.length === 0) {
        return apiError(ErrorCode.VALIDATION_ERROR, "缺少授权范围", 400);
    }

    try {
        await revokeConsent(user.id, scopes);
        return apiSuccess(await getConsentState(user.id));
    } catch (error) {
        logger.error("[Consent] Failed to revoke consent", { error: String(error), userId: user.id });
        return apiError(ErrorCode.INTERNAL_ERROR, "撤回授权失败", 500);
    }
}

export async function PUT() {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
