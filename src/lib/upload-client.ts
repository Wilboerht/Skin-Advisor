/**
 * 统一的图片上传客户端
 * 自动选择存储后端: 阿里云 OSS > 本地存储
 */
import { uploadImageToOSS, isOSSConfigured, type UploadMetadata } from "./oss-upload-client";
import { fetchWithCsrf, fetchWithRetry } from "./fetch-client";
import { MAX_UPLOAD_SIZE, ALLOWED_UPLOAD_TYPES, validateImageFile } from "./upload-constants";

export type StorageProvider = "oss" | "local";

/**
 * 客户端压缩图片（Canvas API，无需 sharp）
 * 限制最大宽度 1200px，输出 JPEG quality 0.85
 */
async function compressImage(file: Blob): Promise<Blob> {
    // 小于 200KB 的图不压缩
    if (file.size < 200 * 1024) return file;

    let bitmap: ImageBitmap | null = null;
    try {
        bitmap = await createImageBitmap(file);
        const MAX_WIDTH = 1200;
        let { width, height } = bitmap;
        if (width > MAX_WIDTH) {
            height = Math.round(height * (MAX_WIDTH / width));
            width = MAX_WIDTH;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return file;

        ctx.drawImage(bitmap, 0, 0, width, height);

        const compressed = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b || file), "image/jpeg", 0.85);
        });
        canvas.remove();
        return compressed;
    } catch {
        return file; // 压缩失败则原图上传
    } finally {
        bitmap?.close();
    }
}

/**
 * 上传图片到云存储
 * @param file 文件对象或 Blob
 * @param filename 可选的文件名
 * @param metadata 可选的游客/会话标识，用于生成隔离的上传路径
 * @returns 公开访问的 URL
 */
export async function uploadImage(
    file: Blob,
    filename: string = "image.jpg",
    metadata?: UploadMetadata
): Promise<string> {
    validateImageFile(file);

    // 上传前压缩
    const compressed = await compressImage(file);

    // 优先使用阿里云 OSS
    if (isOSSConfigured()) {
        try {
            if (process.env.NODE_ENV !== "production") console.log("[Storage] 使用阿里云 OSS 上传");
            return await uploadImageToOSS(compressed, filename, metadata);
        } catch (error) {
            console.warn("[Storage] OSS 上传失败，尝试备选方案:", error);
        }
    }

    // 降级到本地存储
    if (process.env.NODE_ENV !== "production") console.log("[Storage] 使用本地存储上传");
    const signBody: Record<string, unknown> = {
        filename: filename,
        type: compressed.type || "image/jpeg"
    };
    if (metadata?.sessionId) signBody.sessionId = metadata.sessionId;
    if (metadata?.guestId) signBody.guestId = metadata.guestId;
    if (metadata?.cookieId) signBody.cookieId = metadata.cookieId;
    if (metadata?.fingerprint) signBody.fingerprint = metadata.fingerprint;

    const signRes = await fetchWithCsrf("/api/oss/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signBody),
    }, { retries: 2, timeoutMs: 15_000 });

    const signData = await signRes.json();
    if (!signRes.ok || !signData.success) {
        throw new Error(signData.error || "获取上传签名未成功");
    }

    const { uploadUrl, publicUrl } = signData.data;

    const isLocalUpload = typeof uploadUrl === "string" && uploadUrl.startsWith("/api/local-upload");
    const uploadRes = await (isLocalUpload ? fetchWithCsrf(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": compressed.type || "image/jpeg"
        },
        body: compressed
    }, { retries: 2, timeoutMs: 60_000 }) : fetchWithRetry(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": compressed.type || "image/jpeg"
        },
        body: compressed
    }, { timeoutMs: 60_000, retries: 2 }));

    if (!uploadRes.ok) {
        throw new Error("上传图片到本地存储失败");
    }

    return publicUrl;
}

/**
 * 获取当前可用的存储提供商
 */
export function getAvailableProvider(): StorageProvider | null {
    if (isOSSConfigured()) {
        return "oss";
    }
    return "local";
}

// 重新导出便捷方法
export { uploadImageToOSS } from "./oss-upload-client";
export type { UploadMetadata } from "./oss-upload-client";
