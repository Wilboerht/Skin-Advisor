/**
 * 消费补录 BFF（凭证上传）
 * POST /api/account/spent-adjustments/upload
 *
 * 代理官网 OAuth 资源端点 /api/oauth/spent-adjustments/upload（multipart 转发）。
 * 文件校验与存储（私有 bucket 优先）全部在官网侧，子站做会话鉴权、限流与前置粗筛。
 */
import { NextRequest, NextResponse } from "next/server";
import { authorizeAccountBff, bffError, normalizeUpstreamError } from "@/lib/account-bff-proxy";
import { OFFICIAL_BASE_URL } from "@/lib/account-bff";
import { logger } from "@/lib/logger";

// 图片处理 + 私有 bucket 上传，超时放宽到 20s
const UPSTREAM_TIMEOUT_MS = 20000;
// 与官网 uploadConfig.maxFileSize 一致（10MB），仅作前置粗筛
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
    const auth = await authorizeAccountBff(req, { scope: "upload", maxRequests: 20 });
    if (auth.error) return auth.error;

    // 解析子站请求的 multipart，再以新 FormData 转发（File 可跨请求复用）
    let file: File | null = null;
    try {
        const formData = await req.formData();
        const value = formData.get("file");
        if (value instanceof File) file = value;
    } catch {
        return bffError("INVALID_PARAMS", "请求格式错误", 400);
    }
    if (!file) {
        return bffError("NO_FILE", "请选择要上传的图片", 400);
    }

    // 前置粗校验（与官网 uploadConfig 同口径）：省去无效请求的带宽与解析开销，
    // 真实类型/大小以官网侧 magic bytes 校验为准
    if (!file.type.startsWith("image/")) {
        return bffError("INVALID_FILE", "凭证仅支持图片格式（JPG/PNG/WebP/GIF）", 400);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        return bffError("INVALID_FILE", "文件大小超出限制（最大 10MB）", 400);
    }

    try {
        const upstreamForm = new FormData();
        upstreamForm.append("file", file);

        const res = await fetch(`${OFFICIAL_BASE_URL}/api/oauth/spent-adjustments/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${auth.token}` },
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
        return bffError("UPSTREAM_ERROR", "官网服务暂时不可用，请稍后再试", 502);
    }
}
