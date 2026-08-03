/**
 * 展品图迁移脚本：
 * 1. 把 public/uploads/ 根目录下的所有上传文件移动到 public/uploads/products/
 * 2. 更新数据库 Product.image / Product.images / Campaign.coverImage / Campaign.prizes
 *    中形如 /uploads/xxx.png 的引用为 /uploads/products/xxx.png
 *
 * 目的：展品图是永久资产，不能留在受 30 天清理策略约束的 uploads 根目录。
 *
 * 用法（服务器上执行）：
 *   npx -y tsx scripts/migrate-product-uploads.ts
 */
import { config } from "dotenv";
// 按环境顺序加载：生产优先，本地覆盖
config({ path: ".env.production" });
config({ path: ".env" });
config({ path: ".env.local", override: true });

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL;
if (!url) {
    throw new Error("DATABASE_URL is not set");
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require("pg");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const UPLOAD_ROOT = path.resolve(process.cwd(), "public", "uploads");
const PRODUCTS_DIR = path.join(UPLOAD_ROOT, "products");

// 只匹配 uploads 根目录下的图片引用（不含子目录），如 /uploads/1783430944472-d11d1ea4.png
const TOP_LEVEL_UPLOAD_RE = /^\/uploads\/([^/]+\.(?:png|jpe?g|webp|gif))$/i;

function rewriteRef(ref: unknown): string | null {
    if (typeof ref !== "string") return null;
    const m = ref.match(TOP_LEVEL_UPLOAD_RE);
    if (!m) return null;
    return `/uploads/products/${m[1]}`;
}

async function main() {
    // ===== 1. 移动文件 =====
    fs.mkdirSync(PRODUCTS_DIR, { recursive: true });
    let moved = 0;
    const entries = fs.readdirSync(UPLOAD_ROOT, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isFile()) continue;
        const src = path.join(UPLOAD_ROOT, entry.name);
        const dest = path.join(PRODUCTS_DIR, entry.name);
        try {
            fs.renameSync(src, dest);
            moved++;
        } catch (err) {
            console.warn(`⚠️ 移动失败: ${entry.name}`, (err as Error).message);
        }
    }
    console.log(`📦 已移动 ${moved} 个文件 → public/uploads/products/`);

    // ===== 2. 更新 Product =====
    const products = await prisma.product.findMany({
        select: { id: true, name: true, image: true, images: true },
    });
    let productsUpdated = 0;
    for (const p of products) {
        const newImage = rewriteRef(p.image) ?? p.image;
        let imagesChanged = false;
        let newImages: unknown = p.images;
        if (Array.isArray(p.images)) {
            const arr = (p.images as unknown[]).map((img) => {
                const rewritten = rewriteRef(img);
                if (rewritten) imagesChanged = true;
                return rewritten ?? img;
            });
            if (imagesChanged) newImages = arr;
        }
        if (newImage !== p.image || imagesChanged) {
            await prisma.product.update({
                where: { id: p.id },
                data: { image: newImage, images: imagesChanged ? (newImages as never) : undefined },
            });
            productsUpdated++;
            console.log(`   ✅ Product「${p.name}」引用已更新`);
        }
    }
    console.log(`🗂️  Product 更新 ${productsUpdated} / ${products.length} 条`);

    // ===== 3. 更新 Campaign（封面图与奖品图，若有本地上传引用）=====
    const campaigns = await prisma.campaign.findMany({
        select: { id: true, title: true, coverImage: true, prizes: true },
    });
    let campaignsUpdated = 0;
    for (const c of campaigns) {
        const newCover = rewriteRef(c.coverImage) ?? c.coverImage;
        let prizesChanged = false;
        let newPrizes: unknown = c.prizes;
        if (Array.isArray(c.prizes)) {
            const arr = (c.prizes as Array<Record<string, unknown>>).map((prize) => {
                const rewritten = rewriteRef(prize?.image);
                if (rewritten) {
                    prizesChanged = true;
                    return { ...prize, image: rewritten };
                }
                return prize;
            });
            if (prizesChanged) newPrizes = arr;
        }
        if (newCover !== c.coverImage || prizesChanged) {
            await prisma.campaign.update({
                where: { id: c.id },
                data: {
                    coverImage: newCover,
                    prizes: prizesChanged ? (newPrizes as never) : undefined,
                },
            });
            campaignsUpdated++;
            console.log(`   ✅ Campaign「${c.title}」引用已更新`);
        }
    }
    console.log(`🗂️  Campaign 更新 ${campaignsUpdated} / ${campaigns.length} 条`);

    console.log("\n✅ 迁移完成！请验证：curl -I https://<域名>/uploads/products/<文件名>");
}

main()
    .catch((err) => {
        console.error("❌ 迁移失败:", err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
