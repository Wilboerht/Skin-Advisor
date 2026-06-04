import { deleteOSSFiles } from "./ali-oss";
import fs from "fs/promises";
import path from "path";

/**
 * 删除头像生成的原始源照片（本地文件/云端对象）
 */
export async function deleteSourcePhoto(frontPhoto: string | null | undefined): Promise<void> {
  if (!frontPhoto) return;

  // Base64 data URI: 无持久化文件需要删除
  if (frontPhoto.startsWith("data:")) return;

  // 本地文件路径
  if (frontPhoto.startsWith("/")) {
    try {
      const relativePath = frontPhoto.slice(1);
      const normalized = path.normalize(relativePath);

      // 路径穿越防护
      if (path.isAbsolute(normalized) || normalized.startsWith("..") || normalized.includes(".." + path.sep)) {
        console.warn(`[Privacy] Blocked path traversal attempt: ${frontPhoto}`);
        return;
      }

      const uploadRoot = path.resolve(process.cwd(), "public", "uploads");
      let filePath: string;
      if (normalized.startsWith("uploads/") || normalized.startsWith("uploads\\")) {
        filePath = path.resolve(process.cwd(), "public", normalized);
      } else {
        filePath = path.resolve(uploadRoot, normalized);
      }

      if (!filePath.startsWith(uploadRoot + path.sep) && filePath !== uploadRoot) {
        console.warn(`[Privacy] Blocked out-of-bounds file access: ${frontPhoto}`);
        return;
      }

      await fs.unlink(filePath);
      console.log(`[Privacy] Deleted local source photo: ${frontPhoto}`);
    } catch {
      // 忽略删除失败（文件可能已被清理）
    }
    return;
  }

  // 云端 URL (OSS)
  if (frontPhoto.startsWith("http")) {
    try {
      await deleteOSSFiles([frontPhoto]);
      console.log(`[Privacy] Deleted OSS source photo`);
    } catch (e) {
      console.error(`[Privacy] Failed to delete cloud source photo:`, e);
    }
  }
}
