import { fetchWithCsrf } from "./fetch-client";

export interface UploadMetadata {
    sessionId?: string;
    guestId?: string;
    cookieId?: string;
    fingerprint?: string;
}

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
 * 检查阿里云 OSS 是否已配置
 */
export function isOSSConfigured(): boolean {
    return (
        !!process.env.NEXT_PUBLIC_ALI_OSS_REGION ||
        !!process.env.ALI_OSS_REGION
    );
}

/**
 * 上传文件到阿里云 OSS (直传)
 * @param file 文件对象或 Blob
 * @param filename 文件名
 * @param metadata 可选的游客/会话标识
 */
export async function uploadImageToOSS(file: Blob, filename: string = "image.jpg", metadata?: UploadMetadata): Promise<string> {
    validateImageFile(file);

    // 1. 获取上传签名
    const signBody: Record<string, unknown> = {
        filename: filename,
        type: file.type || "image/jpeg"
    };
    if (metadata?.sessionId) signBody.sessionId = metadata.sessionId;
    if (metadata?.guestId) signBody.guestId = metadata.guestId;
    if (metadata?.cookieId) signBody.cookieId = metadata.cookieId;
    if (metadata?.fingerprint) signBody.fingerprint = metadata.fingerprint;

    const signRes = await fetchWithCsrf("/api/oss/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signBody),
    });

    const signData = await signRes.json();
    if (!signRes.ok || !signData.success) {
        throw new Error(signData.error || "获取上传签名失败");
    }

    const { uploadUrl, publicUrl } = signData.data;

    // 2. 直传 OSS（本地降级接口需要 CSRF）
    const isLocalUpload = typeof uploadUrl === "string" && uploadUrl.startsWith("/api/local-upload");
    const uploadRes = await (isLocalUpload ? fetchWithCsrf(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": file.type || "image/jpeg"
        },
        body: file
    }) : fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": file.type || "image/jpeg"
        },
        body: file
    }));

    if (!uploadRes.ok) {
        throw new Error("上传图片到 OSS 失败");
    }

    return publicUrl;
}
