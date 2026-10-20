/**
 * 统一图片上传客户端：优先阿里云 OSS，未配置时降级本地存储。
 */
import { uploadImageToOSS, isOSSConfigured, type UploadMetadata } from "./oss-upload-client";
import { fetchWithCsrf, fetchWithRetry } from "./fetch-client";
import { validateImageFile } from "./upload-constants";

export type StorageProvider = "oss" | "local";

/**
 * 客户端压缩图片（Canvas API，无需 sharp）：
 * 最大宽度 1200px，输出 JPEG quality 0.85。
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
            height = Math.round((MAX_WIDTH / width) * height);
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
 * 上传图片到云存储。
 * @param file 文件对象或 Blob
 * @param filename 文件名
 * @param metadata 可选的游客/会话/用途标识（kind=avatar 时进入 avatars/ 永久目录）
 */
export async function uploadImage(
    file: Blob,
    filename: string = "image.jpg",
    metadata?: UploadMetadata
): Promise<string> {
    validateImageFile(file);
    const compressed = await compressImage(file);

    // 优先阿里云 OSS
    if (isOSSConfigured()) {
        try {
            return await uploadImageToOSS(compressed, filename, metadata);
        } catch (error) {
            console.warn("[Storage] OSS 上传失败，尝试备选方案", error);
        }
    }

    // 降级本地存储
    const signBody: Record<string, unknown> = {
        filename,
        type: compressed.type || "image/jpeg",
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

    const { uploadUrl, publicUrl } = signData.data;
    const isLocalUpload = typeof uploadUrl === "string" && uploadUrl.startsWith("/api/local-upload");
    const uploadRes = await (isLocalUpload ? fetchWithCsrf(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": compressed.type || "image/jpeg",
        },
        body: compressed,
    }, { retries: 2, timeoutMs: 60_000 }) : fetchWithRetry(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": compressed.type || "image/jpeg",
        },
        body: compressed,
    }, { timeoutMs: 60_000, retries: 2 }));

    if (!uploadRes.ok) {
        throw new Error("上传图片到本地存储失败");
    }

    return publicUrl;
}

/** 获取当前可用的存储提供商。 */
export function getAvailableProvider(): StorageProvider | null {
    if (isOSSConfigured()) return "oss";
    return "local";
}

export { uploadImageToOSS } from "./oss-upload-client";
export type { UploadMetadata } from "./oss-upload-client";
