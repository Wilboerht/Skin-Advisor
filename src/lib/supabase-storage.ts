/**
 * Supabase Storage 上传客户端
 * 用于上传文件到 Supabase Storage
 */
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

// Storage bucket 名称
const BUCKET_NAME = "face-images";

/**
 * 上传图片到 Supabase Storage
 * @param file 文件对象或 Blob
 * @param filename 可选的文件名
 * @returns 公开访问的 URL
 */
export async function uploadImageToSupabase(
    file: Blob,
    filename: string = "image.jpg"
): Promise<string> {
    const supabase = getSupabaseClient();

    if (!supabase) {
        throw new Error("Supabase 未配置");
    }

    // 生成唯一文件路径: advisor/日期/随机ID.ext
    const date = new Date().toISOString().split("T")[0];
    const randomId = Math.random().toString(36).substring(2, 10);
    const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `advisor/${date}/${randomId}.${ext}`;

    // 上传文件
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
            contentType: file.type || "image/jpeg",
            upsert: false,
        });

    if (error) {
        console.error("Supabase Storage 上传失败:", error);
        throw new Error(`上传失败: ${error.message}`);
    }

    // 获取公开 URL
    const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);

    return urlData.publicUrl;
}

/**
 * 检查 Supabase Storage 是否可用
 */
export function isSupabaseStorageAvailable(): boolean {
    return isSupabaseConfigured();
}

/**
 * 删除 Supabase Storage 中的文件
 * @param urls 文件 URL 列表
 */
export async function deleteSupabaseFiles(urls: string[]): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase || urls.length === 0) return;

    try {
        // 从 URL 提取文件路径
        const paths = urls.map((url) => {
            const urlObj = new URL(url);
            // 路径格式: /storage/v1/object/public/bucket-name/path
            const match = urlObj.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/);
            return match ? match[1] : url;
        }).filter(Boolean);

        if (paths.length > 0) {
            await supabase.storage.from(BUCKET_NAME).remove(paths);
        }
    } catch (e) {
        console.error("删除 Supabase 文件失败:", e);
    }
}
