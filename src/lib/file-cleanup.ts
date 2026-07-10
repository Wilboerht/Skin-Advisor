import { deleteOSSFiles } from "./ali-oss";
import fs, { realpath } from "fs/promises";
import path from "path";
import { logger } from "@/lib/logger";

/**
 * 删除上传的源照片（本地文件/云端对象）
 */
export async function deleteSourcePhoto(photoUrl: string | null | undefined): Promise<void> {
  if (!photoUrl) return;

  // Base64 data URI: 无持久化文件需要删除
  if (photoUrl.startsWith("data:")) return;

  // 本地文件路径
  if (photoUrl.startsWith("/")) {
    try {
      const relativePath = photoUrl.slice(1);
      const normalized = path.normalize(relativePath);

      // 路径穿越防护
      if (path.isAbsolute(normalized) || normalized.startsWith("..") || normalized.includes(".." + path.sep)) {
        logger.warn(`[Privacy] Blocked path traversal attempt: ${photoUrl}`);
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
        logger.warn(`[Privacy] Blocked out-of-bounds file access: ${photoUrl}`);
        return;
      }

      // Resolve symlinks to ensure we only delete files inside the upload root
      const realUploadRoot = await realpath(uploadRoot);
      const realFilePath = await realpath(filePath);
      if (
        !realFilePath.startsWith(realUploadRoot + path.sep) &&
        realFilePath !== realUploadRoot
      ) {
        logger.warn(`[Privacy] Blocked symlink escape: ${photoUrl}`);
        return;
      }

      await fs.unlink(realFilePath);
      logger.info(`[Privacy] Deleted local source photo`);
    } catch {
      // 忽略删除失败（文件可能已被清理）
    }
    return;
  }

  // 云端 URL (OSS)
  if (photoUrl.startsWith("http")) {
    try {
      await deleteOSSFiles([photoUrl]);
      logger.info(`[Privacy] Deleted OSS source photo`);
    } catch (e) {
      logger.error(`[Privacy] Failed to delete cloud source photo:`, e);
    }
  }
}
