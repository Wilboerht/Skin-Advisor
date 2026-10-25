import { fetchWithCsrf, fetchWithRetry } from "./fetch-client";
import { MAX_UPLOAD_SIZE, ALLOWED_UPLOAD_TYPES, validateImageFile } from "./upload-constants";

export { MAX_UPLOAD_SIZE, ALLOWED_UPLOAD_TYPES, validateImageFile };

export interface UploadMetadata {
    sessionId?: string;
    guestId?: string;
    cookieId?: string;
    fingerprint?: string;
    /** face = 面部/游客临时上传（guest/，24h 清理）；avatar = 用户头像（avatars/，永久） */
    kind?: "face" | "avatar";
}

/**
 * 检查阿里云 OSS 是否已配置。
 * 注意：客户端只能读取 NEXT_PUBLIC_*；服务端变量不会被 Next 暴露到浏览器。
 */
export function isOSSConfigured(): boolean {
    return (
        !!process.env.NEXT_PUBLIC_ALI_OSS_REGION ||
        !!process.env.ALI_OSS_REGION
    );
}

/**
 * 上传文件到阿里云 OSS（直传）。
 * @param file 文件对象或 Blob
 * @param filename 文件名
 * @param metadata 可选的游客/会话/用途标识
 */
export async function uploadImageToOSS(
    file: Blob,
    filename: string = "image.jpg",
    metadata?: UploadMetadata
): Promise<string> {
    validateImageFile(file);

    // 1. 获取上传签名
    const signBody: Record<string, unknown> = {
        filename,
        type: file.type || "image/jpeg",
        size: file.size,
    };
    if (metadata?.sessionId) signBody.sessionId = metadata.sessionId;
    if (metadata?.guestId) signBody.guestId = metadata.guestId;
    if (metadata?.cookieId) signBody.cookieId = metadata.cookieId;
    if (metadata?.fingerprint) signBody.fingerprint = metadata.fingerprint;
    if (metadata?.kind) signBody.kind = metadata.kind;

    const signRes = await fetchWithCsrf("/api/oss/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signBody),
    }, { retries: 2, timeoutMs: 15_000 });

    const signData = await signRes.json();
    if (!signRes.ok || !signData.success) {
        throw new Error(signData.error || "获取上传签名未成功");
    }

    const {
        storage,
        uploadUrl,
        publicUrl,
        ossAccessKeyId,
        policy,
        signature,
        key,
        successActionStatus,
    } = signData.data;

    // OSS 已配置：PostObject 表单直传（policy 内含 content-length-range）
    if (storage === "oss") {
        const form = new FormData();
        form.append("key", key);
        form.append("policy", policy);
        form.append("OSSAccessKeyId", ossAccessKeyId);
        form.append("signature", signature);
        form.append("success_action_status", successActionStatus || "201");
        form.append("Content-Type", file.type || "image/jpeg");
        form.append("file", file, filename);

        const uploadRes = await fetchWithRetry(uploadUrl, {
            method: "POST",
            body: form,
        }, { timeoutMs: 60_000, retries: 2 });

        if (!uploadRes.ok) {
            throw new Error("上传图片到 OSS 未成功");
        }
        return publicUrl;
    }

    // 本地降级接口需要 CSRF
    const uploadRes = await fetchWithCsrf(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": file.type || "image/jpeg",
        },
        body: file,
    }, { retries: 2, timeoutMs: 60_000 });

    if (!uploadRes.ok) {
        throw new Error("上传图片到本地存储未成功");
    }

    return publicUrl;
}
