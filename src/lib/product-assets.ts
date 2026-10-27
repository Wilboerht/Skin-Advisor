import { readdir, stat, unlink } from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";
import { deleteOSSFiles } from "@/lib/ali-oss";
import { logger } from "@/lib/logger";

export function productImageRefs(image?: string | null, images?: unknown): string[] {
    const refs = new Set<string>();
    if (typeof image === "string" && image.trim()) refs.add(image.trim());
    if (Array.isArray(images)) {
        for (const value of images) {
            if (typeof value === "string" && value.trim()) refs.add(value.trim());
        }
    }
    return [...refs];
}

function localProductPath(ref: string): string | null {
    let pathname = ref;
    if (/^https?:\/\//i.test(ref)) {
        let url: URL;
        let siteHost = "";
        try {
            url = new URL(ref);
            siteHost = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://invalid.local").hostname;
        } catch {
            return null;
        }
        // 只处理本站绝对 URL；其他域名交给 OSS/外部资产处理，避免误删同名本地文件
        if (!siteHost || url.hostname !== siteHost) return null;
        pathname = url.pathname;
    }
    const normalized = pathname.replace(/^\/+/, "");
    const prefix = "uploads/products/";
    if (!normalized.startsWith(prefix)) return null;
    const filename = normalized.slice(prefix.length);
    if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
        return null;
    }
    return path.join(process.cwd(), "public", "uploads", "products", filename);
}

function canonicalRef(ref: string): string {
    if (!/^https?:\/\//i.test(ref)) return ref;
    try {
        return new URL(ref).pathname;
    } catch {
        return ref;
    }
}

async function isReferencedByOtherProduct(ref: string, excludeId: string): Promise<boolean> {
    const products = await prisma.product.findMany({
        where: { id: { not: excludeId } },
        select: { image: true, images: true },
    });
    const target = canonicalRef(ref);
    return products.some((product) =>
        productImageRefs(product.image, product.images).some(
            (candidate) => canonicalRef(candidate) === target
        )
    );
}

async function isReferencedByReport(ref: string): Promise<boolean> {
    const pathname = canonicalRef(ref);
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS(
            SELECT 1
            FROM "AdvisorSession"
            WHERE "archivedAt" IS NULL
              AND "analysisResult" IS NOT NULL
              AND "analysisResult"::text LIKE ${`%${pathname}%`}
        ) AS "exists"
    `;
    return rows[0]?.exists === true;
}

export async function deleteUnreferencedProductAssets(
    refs: string[],
    excludeProductId: string
): Promise<void> {
    for (const ref of new Set(refs)) {
        try {
            if (await isReferencedByOtherProduct(ref, excludeProductId)) continue;
            // 历史报告保存了产品图片快照；仍有报告引用时保留文件，避免旧报告图片失效
            if (await isReferencedByReport(ref)) continue;

            const filePath = localProductPath(ref);
            if (filePath) {
                await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
                    if (error.code !== "ENOENT") throw error;
                });
                continue;
            }

            if (/^https?:\/\//i.test(ref)) {
                await deleteOSSFiles([ref]);
            }
        } catch (error) {
            logger.warn("[ProductAssets] Failed to delete asset", { ref, error: String(error) });
        }
    }
}

/**
 * 定期清理 products/ 下已无任何产品/可见报告引用的文件。
 * 延迟 7 天执行，避免误删后台正在编辑但尚未保存的上传。
 */
export async function cleanupOrphanProductAssets(): Promise<number> {
    const dir = path.join(process.cwd(), "public", "uploads", "products");
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const products = await prisma.product.findMany({
        select: { image: true, images: true },
    });
    const referenced = new Set(
        products.flatMap((product) =>
            productImageRefs(product.image, product.images).map((ref) =>
                /^https?:\/\//i.test(ref)
                    ? (() => {
                          try {
                              return new URL(ref).pathname;
                          } catch {
                              return ref;
                          }
                      })()
                    : ref
            )
        )
    );

    let deleted = 0;
    const entries = await readdir(dir).catch(() => []);
    for (const filename of entries) {
        if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) continue;
        const filePath = path.join(dir, filename);
        try {
            const fileStat = await stat(filePath);
            if (!fileStat.isFile() || fileStat.mtimeMs > cutoff) continue;

            const ref = `/uploads/products/${filename}`;
            if (referenced.has(ref)) continue;
            if (await isReferencedByReport(ref)) continue;

            await unlink(filePath);
            deleted++;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                logger.warn("[ProductAssets] Orphan cleanup failed", {
                    filename,
                    error: String(error),
                });
            }
        }
    }
    return deleted;
}
