/**
 * 统一的图片上传客户端
 * 自动选择存储后端: 阿里云 OSS > 本地存储
 */
import { uploadImageToOSS, isOSSConfigured } from "./oss-upload-client";

export type StorageProvider = "oss" | "local";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function validateImageFile(file: Blob): void {
    if (!file.type || !ALLOWED_UPLOAD_TYPES.includes(file.type)) {
        throw new Error("不支持的图片格式，仅支持 jpg/png/webp/gif");
    }
    if (file.size > MAX_UPLOAD_SIZE) {
        throw new Error("图片大小超过 10MB 限制");
    }
}

/**
 * 客户端压缩图片（Canvas API，无需 sharp）
 * 限制最大宽度 1200px，输出 JPEG quality 0.85
 */
async function compressImage(file: Blob): Promise<Blob> {
    // 小于 200KB 的图不压缩
    if (file.size < 200 * 1024) return file;

    try {
        const bitmap = await createImageBitmap(file);
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
        bitmap.close();

        const compressed = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b || file), "image/jpeg", 0.85);
        });
        canvas.remove();
        return compressed;
    } catch {
        return file; // 压缩失败则原图上传
    }
}

/**
 * 上传图片到云存储
 * @param file 文件对象或 Blob
 * @param filename 可选的文件名
 * @returns 公开访问的 URL
 */
export async function uploadImage(
    file: Blob,
    filename: string = "image.jpg"
): Promise<string> {
    validateImageFile(file);

    // 上传前压缩
    const compressed = await compressImage(file);

    // 优先使用阿里云 OSS
    if (isOSSConfigured()) {
        try {
            console.log("[Storage] 使用阿里云 OSS 上传");
            return await uploadImageToOSS(compressed, filename);
        } catch (error) {
            console.warn("[Storage] OSS 上传失败，尝试备选方案:", error);
        }
    }

    // 降级到本地存储
    console.log("[Storage] 使用本地存储上传");
    const signRes = await fetch("/api/oss/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            filename: filename,
            type: compressed.type || "image/jpeg"
        }),
    });

    const signData = await signRes.json();
    if (!signRes.ok || !signData.success) {
        throw new Error(signData.error || "获取上传签名失败");
    }

    const { uploadUrl, publicUrl } = signData.data;

    const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": compressed.type || "image/jpeg"
        },
        body: compressed
    });

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
