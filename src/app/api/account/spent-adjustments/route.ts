/**
 * 消费补录 BFF（列表 / 提交）
 * GET  /api/account/spent-adjustments - 我的补录申请列表
 * POST /api/account/spent-adjustments - 提交消费补录申请
 *
 * 代理官网 OAuth 资源端点 /api/oauth/spent-adjustments（Bearer 转发），
 * 校验与业务逻辑全部在官网侧，子站不重复实现；响应契约与官网会话路由一致：
 * 成功 { success: true, data }，失败 { success: false, error: { code, message } }。
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/sso-auth";
import { resolveOfficialAccessToken, OFFICIAL_BASE_URL } from "@/lib/account-bff";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

const UPSTREAM_TIMEOUT_MS = 8000;

function errorResponse(code: string, message: string, status: number) {
    return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/** 官网不可达：统一 502（避免把网络异常伪装成业务错误） */
function upstreamUnavailable() {
    return errorResponse("UPSTREAM_ERROR", "官网服务暂时不可用，请稍后再试", 502);
}

/**
 * 归一化官网错误体：
 * - 已是子站契约（{ success: false, error }）时原样透传；
 * - OAuth 鉴权层错误（{ error, error_description }）映射为契约结构。
 */
function normalizeUpstreamError(data: unknown, status: number) {
    if (data && typeof data === "object" && (data as { success?: unknown }).success === false) {
        return data;
    }
    const obj = (data ?? {}) as { error?: string; error_description?: string };
    const code = status === 401 ? "UNAUTHORIZED" : obj.error ? obj.error.toUpperCase() : "UPSTREAM_ERROR";
    return {
        success: false,
        error: { code, message: obj.error_description || "官网服务暂时不可用，请稍后再试" },
    };
}

/** 会话 + 限流 + 官网 token 统一前置；失败时返回可直接响应的 error */
type AuthorizeResult =
    | { error: NextResponse; token?: undefined }
    | { error?: undefined; token: string };

async function authorize(req: NextRequest, scope: string): Promise<AuthorizeResult> {
    const user = await getSessionUser(req);
    if (!user) {
        return { error: errorResponse("UNAUTHORIZED", "请先登录", 401) };
    }

    const limit = await rateLimit(`account-${scope}:${user.id}`, "default", {
        maxRequests: 60,
        windowMs: 60_000,
    });
    if (!limit.success) {
        return { error: errorResponse("RATE_LIMITED", "请求过于频繁，请稍后再试", 429) };
    }

    const token = await resolveOfficialAccessToken(req);
    if (!token) {
        return { error: errorResponse("UNAUTHORIZED", "登录已过期，请重新登录", 401) };
    }

    return { token };
}

export async function GET(req: NextRequest) {
    const auth = await authorize(req, "spent");
    if (auth.error) return auth.error;

    try {
        const res = await fetch(`${OFFICIAL_BASE_URL}/api/oauth/spent-adjustments`, {
            headers: { Authorization: `Bearer ${auth.token}` },
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
            cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            logger.warn("[account/spent-adjustments] 官网响应异常", { status: res.status });
            return NextResponse.json(normalizeUpstreamError(data, res.status), { status: res.status });
        }
        return NextResponse.json(data);
    } catch (err) {
        logger.warn("[account/spent-adjustments] 官网不可达", { error: String(err) });
        return upstreamUnavailable();
    }
}

export async function POST(req: NextRequest) {
    const auth = await authorize(req, "spent");
    if (auth.error) return auth.error;

    // 透传原始 JSON body（校验在官网侧，避免两侧 schema 漂移）
    let body: string;
    try {
        body = await req.text();
    } catch {
        return errorResponse("INVALID_PARAMS", "请求格式错误", 400);
    }

    try {
        const res = await fetch(`${OFFICIAL_BASE_URL}/api/oauth/spent-adjustments`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${auth.token}`,
                "Content-Type": "application/json",
            },
            body,
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
            cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            logger.warn("[account/spent-adjustments] 官网响应异常", { status: res.status });
            return NextResponse.json(normalizeUpstreamError(data, res.status), { status: res.status });
        }
        return NextResponse.json(data);
    } catch (err) {
        logger.warn("[account/spent-adjustments] 官网不可达", { error: String(err) });
        return upstreamUnavailable();
    }
}
