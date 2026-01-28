/**
 * 统一的图片上传客户端
 * 自动选择存储后端: Supabase Storage > 阿里云 OSS > 本地存储
 */
import { uploadImageToSupabase, isSupabaseStorageAvailable } from "./supabase-storage";
import { uploadImageToOSS } from "./oss-upload-client";

export type StorageProvider = "supabase" | "oss" | "local";

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
    // 优先使用 Supabase Storage
    if (isSupabaseStorageAvailable()) {
        try {
            console.log("[Storage] 使用 Supabase Storage 上传");
            return await uploadImageToSupabase(file, filename);
        } catch (error) {
            console.warn("[Storage] Supabase 上传失败，尝试备选方案:", error);
        }
    }

    // 其次使用阿里云 OSS
    try {
        console.log("[Storage] 使用阿里云 OSS 上传");
        return await uploadImageToOSS(file, filename);
    } catch (error) {
        console.warn("[Storage] OSS 上传失败:", error);
        throw new Error("图片上传失败：所有存储后端均不可用");
    }
}

/**
 * 获取当前可用的存储提供商
 */
export function getAvailableProvider(): StorageProvider | null {
    if (isSupabaseStorageAvailable()) {
        return "supabase";
    }
    // OSS 配置检查需要在服务端，这里假设可用
    return "oss";
}

// 重新导出便捷方法
export { uploadImageToOSS } from "./oss-upload-client";
export { uploadImageToSupabase, isSupabaseStorageAvailable } from "./supabase-storage";
