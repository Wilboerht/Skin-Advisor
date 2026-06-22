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

    // 优先使用阿里云 OSS
    if (isOSSConfigured()) {
        try {
            console.log("[Storage] 使用阿里云 OSS 上传");
            return await uploadImageToOSS(file, filename);
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
            type: file.type || "image/jpeg"
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
            "Content-Type": file.type || "image/jpeg"
        },
        body: file
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
