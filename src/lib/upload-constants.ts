/** 上传相关公共常量与校验 — 保持单一数据源 */
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_UPLOAD_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function validateImageFile(file: Blob): void {
    if (!file.type || !ALLOWED_UPLOAD_TYPES.includes(file.type)) {
        throw new Error("不支持的图片格式，仅支持 jpg/png/webp/gif");
    }
    if (file.size > MAX_UPLOAD_SIZE) {
        throw new Error("图片大小超过 10MB 限制");
    }
}
