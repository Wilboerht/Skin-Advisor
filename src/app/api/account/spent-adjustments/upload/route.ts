/**
 * 消费补录 BFF（凭证上传）
 * POST /api/account/spent-adjustments/upload
 *
 * 代理官网 OAuth 资源端点 /api/oauth/spent-adjustments/upload（multipart 转发）。
 * 文件校验与存储（私有 bucket 优先）全部在官网侧，子站仅做会话鉴权与限流。
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/sso-auth";
import { resolveOfficialAccessToken, OFFICIAL_BASE_URL } from "@/lib/account-bff";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

// 图片处理 + 私有 bucket 上传，超时放宽到 20s
const UPSTREAM_TIMEOUT_MS = 20000;
// 与官网 uploadConfig.maxFileSize 一致（10MB），仅作前置粗筛
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function errorResponse(code: string, message: string, status: number) {
    return NextResponse.json({ success: false, error: { code, message } }, { status });
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
        error: { code, message: obj.error_description || "上传失败，请稍后重试" },
    };
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user) {
        return errorResponse("UNAUTHORIZED", "请先登录", 401);
    }

    // 按用户限流（与官网会话路由同口径：20 次/分钟）
    const limit = await rateLimit(`account-upload:${user.id}`, "default", {
        maxRequests: 20,
        windowMs: 60_000,
    });
    if (!limit.success) {
        return errorResponse("RATE_LIMITED", "上传过于频繁，请稍后再试", 429);
    }

    // 官网 token 先就绪再解析文件体，避免会话失效时白读上传内容
    const token = await resolveOfficialAccessToken(req);
    if (!token) {
        return errorResponse("UNAUTHORIZED", "登录已过期，请重新登录", 401);
    }

    // 解析子站请求的 multipart，再以新 FormData 转发（File 可跨请求复用）
    let file: File | null = null;
    try {
        const formData = await req.formData();
        const value = formData.get("file");
        if (value instanceof File) file = value;
    } catch {
        return errorResponse("INVALID_PARAMS", "请求格式错误", 400);
    }
    if (!file) {
        return errorResponse("NO_FILE", "请选择要上传的图片", 400);
    }

    // 前置粗校验（与官网 uploadConfig 同口径）：省去无效请求的带宽与解析开销，
    // 真实类型/大小以官网侧 magic bytes 校验为准
    if (!file.type.startsWith("image/")) {
        return errorResponse("INVALID_FILE", "凭证仅支持图片格式（JPG/PNG/WebP/GIF）", 400);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        return errorResponse("INVALID_FILE", "文件大小超出限制（最大 10MB）", 400);
    }

    try {
        const upstreamForm = new FormData();
        upstreamForm.append("file", file);

        const res = await fetch(`${OFFICIAL_BASE_URL}/api/oauth/spent-adjustments/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: upstreamForm,
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
            cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            logger.warn("[account/spent-adjustments/upload] 官网响应异常", { status: res.status });
            return NextResponse.json(normalizeUpstreamError(data, res.status), { status: res.status });
        }
        return NextResponse.json(data);
    } catch (err) {
        logger.warn("[account/spent-adjustments/upload] 官网不可达", { error: String(err) });
        return errorResponse("UPSTREAM_ERROR", "官网服务暂时不可用，请稍后再试", 502);
    }
}
