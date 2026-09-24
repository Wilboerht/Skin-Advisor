/**
 * 账号 BFF 代理共用工具
 *
 * 供 src/app/api/account/* 路由使用：会话鉴权 → 限流 → 取官网 access token
 * → 以 Bearer 转发官网 OAuth 资源端点，并统一错误体归一化。
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/sso-auth";
import { resolveOfficialAccessToken, OFFICIAL_BASE_URL } from "@/lib/account-bff";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

const DEFAULT_TIMEOUT_MS = 8000;

export function bffError(code: string, message: string, status: number) {
    return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export type AccountBffAuthorizeResult =
    | { error: NextResponse; token?: undefined }
    | { error?: undefined; token: string };

/** 会话 + 限流 + 官网 token 统一前置；失败时返回可直接响应的 error */
export async function authorizeAccountBff(
    req: NextRequest,
    options: { scope: string; maxRequests?: number; windowMs?: number }
): Promise<AccountBffAuthorizeResult> {
    const user = await getSessionUser(req);
    if (!user) {
        return { error: bffError("UNAUTHORIZED", "请先登录", 401) };
    }

    const limit = await rateLimit(`account-${options.scope}:${user.id}`, "default", {
        maxRequests: options.maxRequests ?? 60,
        windowMs: options.windowMs ?? 60_000,
    });
    if (!limit.success) {
        return { error: bffError("RATE_LIMITED", "请求过于频繁，请稍后再试", 429) };
    }

    const token = await resolveOfficialAccessToken(req);
    if (!token) {
        return { error: bffError("UNAUTHORIZED", "登录已过期，请重新登录", 401) };
    }

    return { token };
}

/**
 * 归一化官网错误体：
 * - 已是子站契约（{ success: false, error }）时原样透传；
 * - OAuth 鉴权层错误（{ error, error_description }）映射为契约结构。
 */
export function normalizeUpstreamError(data: unknown, status: number) {
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

/** 转发官网 OAuth 资源端点（JSON），原样透传状态码与响应体 */
export async function proxyOfficialJson(options: {
    token: string;
    /** 官网路径（含 query），如 /api/oauth/points/gifts */
    path: string;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    /** 原始 JSON 字符串（透传避免两侧 schema 漂移） */
    body?: string;
    timeoutMs?: number;
}): Promise<NextResponse> {
    try {
        const res = await fetch(`${OFFICIAL_BASE_URL}${options.path}`, {
            method: options.method ?? "GET",
            headers: {
                Authorization: `Bearer ${options.token}`,
                ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            body: options.body,
            signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
            cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            logger.warn("[account-bff] 官网响应异常", { path: options.path, status: res.status });
            return NextResponse.json(normalizeUpstreamError(data, res.status), { status: res.status });
        }
        return NextResponse.json(data);
    } catch (err) {
        logger.warn("[account-bff] 官网不可达", { path: options.path, error: String(err) });
        return bffError("UPSTREAM_ERROR", "官网服务暂时不可用，请稍后再试", 502);
    }
}

/** 读取请求原始 JSON 文本（解析失败返回 null，由调用方决定错误响应） */
export async function readJsonText(req: NextRequest): Promise<string | null> {
    try {
        return await req.text();
    } catch {
        return null;
    }
}
