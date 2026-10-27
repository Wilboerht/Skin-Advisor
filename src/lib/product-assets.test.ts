import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { access, mkdir, rm, writeFile } from "fs/promises";
import path from "path";

const prismaMock = vi.hoisted(() => ({
    product: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/ali-oss", () => ({ deleteOSSFiles: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn() },
}));

import { deleteUnreferencedProductAssets } from "./product-assets";

const productDir = path.join(process.cwd(), "public", "uploads", "products");
const filename = `__test-product-assets-${process.pid}.png`;
const filePath = path.join(productDir, filename);
const ref = `/uploads/products/${filename}`;

describe("deleteUnreferencedProductAssets", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await mkdir(productDir, { recursive: true });
        await writeFile(filePath, "test");
        prismaMock.product.findMany.mockResolvedValue([]);
        prismaMock.$queryRaw.mockResolvedValue([{ exists: false }]);
    });

    afterEach(async () => {
        await rm(filePath, { force: true });
    });

    it("删除无其他产品、无可见报告引用的文件", async () => {
        await deleteUnreferencedProductAssets([ref], "product-1");
        await expect(access(filePath)).rejects.toThrow();
    });

    it("保留仍被可见报告引用的文件", async () => {
        prismaMock.$queryRaw.mockResolvedValue([{ exists: true }]);
        await deleteUnreferencedProductAssets([ref], "product-1");
        await expect(access(filePath)).resolves.toBeUndefined();
    });

    it("保留仍被其他产品引用的文件", async () => {
        prismaMock.product.findMany.mockResolvedValue([
            { image: ref, images: [] },
        ]);
        await deleteUnreferencedProductAssets([ref], "product-1");
        await expect(access(filePath)).resolves.toBeUndefined();
    });
});
