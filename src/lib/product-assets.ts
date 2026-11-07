import { readdir, stat, unlink } from "fs/promises";
import path from "path";
import { Prisma } from "@prisma/client";
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

/**
 * 批量查询哪些资源仍被可见报告引用：
 * 一次 SQL 处理多个候选路径，避免清理任务对每个文件做一次 LIKE 全表扫描。
 */
async function findReportReferencedRefs(refs: string[]): Promise<Set<string>> {
    if (refs.length === 0) return new Set();
    const patterns = [...new Set(refs.map(canonicalRef))];
    const values = Prisma.join(patterns.map((value) => Prisma.sql`${value}`));
    const rows = await prisma.$queryRaw<Array<{ ref: string }>>(Prisma.sql`
        SELECT p.ref
        FROM unnest(ARRAY[${values}]::text[]) AS p(ref)
        WHERE EXISTS (
            SELECT 1
            FROM "AdvisorSession" s
            WHERE s."archivedAt" IS NULL
              AND s."analysisResult" IS NOT NULL
              AND s."analysisResult"::text LIKE '%' || p.ref || '%'
        )
    `);
    return new Set(rows.map((row) => row.ref));
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

    const entries = await readdir(dir).catch(() => []);
    const candidates: Array<{ filename: string; filePath: string; ref: string }> = [];
    for (const filename of entries) {
        if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) continue;
        const filePath = path.join(dir, filename);
        try {
            const fileStat = await stat(filePath);
            if (!fileStat.isFile() || fileStat.mtimeMs > cutoff) continue;

            const ref = `/uploads/products/${filename}`;
            if (referenced.has(ref)) continue;
            candidates.push({ filename, filePath, ref });
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                logger.warn("[ProductAssets] Orphan candidate check failed", {
                    filename,
                    error: String(error),
                });
            }
        }
    }

    // 每 100 个候选做一次批量报告引用查询，避免 O(文件数 × 全表扫描)
    const reportReferenced = new Set<string>();
    const BATCH = 100;
    for (let i = 0; i < candidates.length; i += BATCH) {
        const chunk = candidates.slice(i, i + BATCH);
        try {
            const matches = await findReportReferencedRefs(chunk.map((item) => item.ref));
            matches.forEach((ref) => reportReferenced.add(ref));
        } catch (error) {
            logger.warn("[ProductAssets] Batch report reference check failed", {
                count: chunk.length,
                error: String(error),
            });
            // 查询失败时保守处理：本轮不删除这批候选，避免误删仍被报告引用的图片
            chunk.forEach((item) => reportReferenced.add(canonicalRef(item.ref)));
        }
    }

    let deleted = 0;
    for (const candidate of candidates) {
        if (reportReferenced.has(canonicalRef(candidate.ref))) continue;
        try {
            await unlink(candidate.filePath);
            deleted++;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                logger.warn("[ProductAssets] Orphan cleanup failed", {
                    filename: candidate.filename,
                    error: String(error),
                });
            }
        }
    }
    return deleted;
}
