import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    db: { current: null as unknown as Record<string, unknown> },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
    default: {
        $transaction: (fn: (tx: unknown) => Promise<unknown>) => {
            const db = mocks.db.current as { $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> };
            return db.$transaction(fn);
        },
    },
}));
vi.mock("@/lib/logger", () => ({ logger: mocks.logger }));

import {
    __resetProductSyncLockForTests,
    normalizeProductName,
    normalizeProductPrice,
    sanitizeProductBenefits,
    sanitizeProductImages,
    sanitizeProductPurchaseLinks,
    syncProductsFromMain,
    type ProductSyncWarning,
} from "./product-sync";

type FakeProduct = Record<string, unknown> & { id: string };

function productBase(overrides: Partial<FakeProduct> = {}): FakeProduct {
    return {
        id: "p1",
        name: "测试产品",
        category: "面霜",
        image: "/uploads/products/old.png",
        images: ["/uploads/products/old.png"],
        price: "2800",
        description: "旧描述",
        keyIngredients: ["成分A"],
        suitableSkinTypes: ["oily"],
        benefits: ["保湿"],
        active: true,
        featured: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        howToUse: null,
        origin: null,
        capacity: null,
        affiliateLinks: null,
        purchaseLinks: null,
        negativeFor: [],
        recommendReasons: null,
        sourceProductId: null,
        sourceUpdatedAt: null,
        sourceSyncedAt: null,
        sourceMissingAt: null,
        ...overrides,
    };
}

function createFakeDb(initialProducts: FakeProduct[] = []) {
    const products = initialProducts.map((product) => ({ ...product }));
    const settings = new Map<string, unknown>();
    const tx = {
        setting: {
            findMany: vi.fn(async ({ where }: { where: { key: { in: string[] } } }) => {
                return Array.from(settings.entries())
                    .filter(([key]) => where.key.in.includes(key))
                    .map(([key, value]) => ({ key, value }));
            }),
            upsert: vi.fn(
                async ({
                    where,
                    create,
                    update,
                }: {
                    where: { key: string };
                    create: { value: unknown };
                    update: { value: unknown };
                }) => {
                    const value = update?.value ?? create?.value;
                    settings.set(where.key, value);
                    return { key: where.key, value };
                }
            ),
        },
        product: {
            findMany: vi.fn(async () => products.map((product) => ({ ...product }))),
            update: vi.fn(
                async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
                    const index = products.findIndex((product) => product.id === where.id);
                    products[index] = { ...products[index], ...data };
                    return products[index];
                }
            ),
            create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
                const product = {
                    ...productBase({ id: `new-${products.length + 1}` }),
                    ...data,
                };
                products.push(product);
                return product;
            }),
        },
    };
    const db = {
        $transaction: vi.fn(async (fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    return { db, tx, products, settings };
}

function snapshot(products: unknown[], options: Record<string, unknown> = {}) {
    return {
        schemaVersion: 1,
        generatedAt: "2026-10-27T00:00:00.000Z",
        products,
        options: { trigger: "test", ...options },
    };
}

function mainProduct(overrides: Record<string, unknown> = {}) {
    return {
        sourceProductId: "main-1",
        name: "测试产品",
        category: "面霜",
        price: "2,800",
        description: "主站描述",
        published: true,
        updatedAt: "2026-10-27T00:00:00.000Z",
        capacity: "50ml",
        images: ["https://nihplod.cn/uploads/products/main.webp"],
        purchaseLinks: [
            {
                platformKey: "tmall",
                platform: "天猫国际",
                url: "https://tmall.example/item",
            },
        ],
        purchaseLinksTotal: 1,
        benefits: ["保湿"],
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PRODUCT_SYNC_ENABLED;
    __resetProductSyncLockForTests();
});

describe("product sync helpers", () => {
    it("normalizeProductName 去掉空白并忽略大小写", () => {
        expect(normalizeProductName("  Face  Cream ")).toBe("facecream");
    });

    it("normalizeProductPrice 去掉千分位和货币符号", () => {
        expect(normalizeProductPrice("¥1,350.00")).toBe("1350");
        expect(normalizeProductPrice(2800)).toBe("2800");
        expect(normalizeProductPrice("面议")).toBe("面议");
    });

    it("sanitizeProductImages 过滤非法 URL 并限制 5 张", () => {
        const warnings: ProductSyncWarning[] = [];
        const images = sanitizeProductImages(
            [
                "https://nihplod.cn/1.webp",
                "https://nihplod.cn/2.webp",
                "javascript:alert(1)",
                "https://nihplod.cn/1.webp",
                "https://nihplod.cn/3.webp",
                "https://nihplod.cn/4.webp",
                "https://nihplod.cn/5.webp",
                "https://nihplod.cn/6.webp",
            ],
            warnings
        );
        expect(images).toEqual([
            "https://nihplod.cn/1.webp",
            "https://nihplod.cn/2.webp",
            "https://nihplod.cn/3.webp",
            "https://nihplod.cn/4.webp",
            "https://nihplod.cn/5.webp",
        ]);
        expect(warnings.some((warning) => warning.code === "INVALID_IMAGE")).toBe(true);
        expect(warnings.some((warning) => warning.code === "IMAGE_TRUNCATED")).toBe(true);
    });

    it("sanitizeProductPurchaseLinks 过滤不支持/重复平台并校验微信小店短链", () => {
        const warnings: ProductSyncWarning[] = [];
        const links = sanitizeProductPurchaseLinks(
            [
                { platformKey: "tmall", url: "https://tmall.example/1" },
                { platformKey: "tmall", url: "https://tmall.example/2" },
                { platformKey: "jd", platform: "京东", url: "https://jd.example" },
                { platformKey: "wechat-shop", url: "https://shop.example" },
                { platformKey: "douyin", url: "https://douyin.example" },
            ],
            warnings
        );
        expect(links.map((link) => link.platformKey)).toEqual(["tmall", "douyin"]);
        expect(warnings.some((warning) => warning.code === "UNSUPPORTED_PURCHASE_PLATFORM")).toBe(true);
        expect(warnings.some((warning) => warning.code === "DUPLICATE_PURCHASE_PLATFORM")).toBe(true);
        expect(warnings.some((warning) => warning.code === "WECHAT_SHOP_WITHOUT_SHORT_LINK")).toBe(true);
    });

    it("sanitizeProductBenefits 去重并限制长度", () => {
        expect(sanitizeProductBenefits([" 保湿 ", "保湿", "修护"])).toEqual(["保湿", "修护"]);
    });
});

describe("syncProductsFromMain", () => {
    it("新主站产品创建为停用，推荐字段留空", async () => {
        const fake = createFakeDb();
        mocks.db.current = fake.db;
        const outcome = await syncProductsFromMain(snapshot([mainProduct()]));
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.data.created).toBe(1);
        const created = fake.products[0];
        expect(created.active).toBe(false);
        expect(created.featured).toBe(false);
        expect(created.sourceProductId).toBe("main-1");
        expect(created.price).toBe("2800");
        expect(created.capacity).toBe("50ml");
        expect(created.suitableSkinTypes).toEqual([]);
        expect(created.negativeFor).toEqual([]);
        expect(created.keyIngredients).toEqual([]);
    });

    it("已同步产品更新基础字段，保留推荐属性与 active", async () => {
        const existing = productBase({
            id: "p1",
            sourceProductId: "main-1",
            active: true,
            suitableSkinTypes: ["oily", "dry"],
            negativeFor: ["孕妇"],
            price: "2800",
            capacity: null,
        });
        const fake = createFakeDb([existing]);
        mocks.db.current = fake.db;
        const outcome = await syncProductsFromMain(snapshot([mainProduct()]));
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.data.updated).toBe(1);
        expect(fake.products[0].description).toBe("主站描述");
        expect(fake.products[0].capacity).toBe("50ml");
        expect(fake.products[0].images).toEqual([
            "https://nihplod.cn/uploads/products/main.webp",
        ]);
        expect(fake.products[0].active).toBe(true);
        expect(fake.products[0].suitableSkinTypes).toEqual(["oily", "dry"]);
        expect(fake.products[0].negativeFor).toEqual(["孕妇"]);
    });

    it("主站取消发布只停用，不用草稿覆盖内容", async () => {
        const existing = productBase({
            id: "p1",
            sourceProductId: "main-1",
            active: true,
            description: "子站旧描述",
        });
        const fake = createFakeDb([existing]);
        mocks.db.current = fake.db;
        const outcome = await syncProductsFromMain(
            snapshot([mainProduct({ published: false, description: "" })])
        );
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.data.deactivated).toBe(1);
        expect(fake.products[0].active).toBe(false);
        expect(fake.products[0].description).toBe("子站旧描述");
    });

    it("主站删除的产品停用并记录 sourceMissingAt", async () => {
        const existing = productBase({
            id: "p1",
            sourceProductId: "main-deleted",
            active: true,
        });
        const fake = createFakeDb([existing]);
        mocks.db.current = fake.db;
        const outcome = await syncProductsFromMain(snapshot([mainProduct()]));
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.data.missing).toBe(1);
        expect(fake.products[0].active).toBe(false);
        expect(fake.products[0].sourceMissingAt).toBeInstanceOf(Date);
    });

    it("bindByName 首次绑定现有同名产品", async () => {
        const existing = productBase({
            id: "p1",
            name: "测试产品",
            sourceProductId: null,
            active: true,
            price: "2800",
        });
        const fake = createFakeDb([existing]);
        mocks.db.current = fake.db;
        const outcome = await syncProductsFromMain(
            snapshot([mainProduct()], { bindByName: true })
        );
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.data.bound).toBe(1);
        expect(fake.products[0].sourceProductId).toBe("main-1");
        expect(fake.products[0].active).toBe(true);
    });

    it("dry-run 不写库，只返回变更计划", async () => {
        const fake = createFakeDb();
        mocks.db.current = fake.db;
        const outcome = await syncProductsFromMain(
            snapshot([mainProduct()], { dryRun: true })
        );
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.data.dryRun).toBe(true);
        expect(outcome.data.created).toBe(1);
        expect(fake.tx.product.create).not.toHaveBeenCalled();
        expect(fake.tx.product.update).not.toHaveBeenCalled();
        expect(fake.tx.setting.upsert).not.toHaveBeenCalled();
        expect(fake.products).toHaveLength(0);
    });

    it("空快照默认拒绝", async () => {
        const fake = createFakeDb();
        mocks.db.current = fake.db;
        const outcome = await syncProductsFromMain(snapshot([]));
        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.code).toBe("EMPTY_SNAPSHOT");
    });

    it("产品数量骤降超过 50% 时拒绝", async () => {
        const fake = createFakeDb();
        fake.settings.set("advisor_product_sync_last_total", 10);
        mocks.db.current = fake.db;
        const products = Array.from({ length: 4 }, (_, index) =>
            mainProduct({ sourceProductId: `main-${index + 1}`, name: `产品${index + 1}` })
        );
        const outcome = await syncProductsFromMain(snapshot(products));
        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.code).toBe("SYNC_COUNT_DROP");
    });

    it("force 可绕过数量骤降保护", async () => {
        const fake = createFakeDb();
        fake.settings.set("advisor_product_sync_last_total", 10);
        mocks.db.current = fake.db;
        const products = Array.from({ length: 4 }, (_, index) =>
            mainProduct({ sourceProductId: `main-${index + 1}`, name: `产品${index + 1}` })
        );
        const outcome = await syncProductsFromMain(snapshot(products, { force: true }));
        expect(outcome.ok).toBe(true);
    });

    it("过期快照跳过", async () => {
        const fake = createFakeDb();
        fake.settings.set(
            "advisor_product_sync_last_generated_at",
            "2026-10-28T00:00:00.000Z"
        );
        mocks.db.current = fake.db;
        const outcome = await syncProductsFromMain(snapshot([mainProduct()]));
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.data.skipped).toBe(true);
        expect(outcome.data.skippedReason).toBe("stale_snapshot");
    });

    it("PRODUCT_SYNC_ENABLED=false 时拒绝", async () => {
        process.env.PRODUCT_SYNC_ENABLED = "false";
        const fake = createFakeDb();
        mocks.db.current = fake.db;
        const outcome = await syncProductsFromMain(snapshot([mainProduct()]));
        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.code).toBe("SYNC_DISABLED");
    });
});
