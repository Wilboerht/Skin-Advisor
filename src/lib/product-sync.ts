/**
 * 主站 → 测肤子站 产品同步
 *
 * 设计口径：
 * - 主站是产品基础信息（名称/分类/价格/容量/描述/用法/产地/图片/购买链接）的唯一数据源；
 * - 子站保留推荐属性（active/featured/suitableSkinTypes/negativeFor/recommendReasons/
 *   keyIngredients/benefits），同步绝不覆盖；
 * - 主站取消发布或删除只收紧 active，不自动启用；
 * - 新主站产品在子站创建为 active=false，等待管理员配置推荐属性；
 * - 价格存纯数字字符串，避免子站预算算法把 "2,800" 解析成 2；
 * - 任何不合法字段只跳过该字段/该产品并返回 warning，不阻塞整批、不误停用。
 */
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { buildAffiliateLinks, type ProductPurchaseLink } from "@/lib/product-links";
import {
    PURCHASE_PLATFORM_KEYS,
    PURCHASE_PLATFORM_LABELS,
    type PurchasePlatformKey,
} from "@/lib/purchase-platforms";
import {
    MAX_CAPACITY_LENGTH,
    MAX_CATEGORY_LENGTH,
    MAX_DESCRIPTION_LENGTH,
    MAX_HOW_TO_USE_LENGTH,
    MAX_IMAGE_COUNT,
    MAX_IMAGE_URL_LENGTH,
    MAX_MINI_PROGRAM_SHORT_LINK_LENGTH,
    MAX_NAME_LENGTH,
    MAX_ORIGIN_LENGTH,
    MAX_PRICE_LENGTH,
    MAX_PURCHASE_URL_LENGTH,
    MAX_STORE_PRODUCT_ID_LENGTH,
    MAX_TAG_ARRAY_LENGTH,
    MAX_TAG_ITEM_LENGTH,
} from "@/types/product";

export interface ProductSyncOptions {
    trigger?: string;
    bindByName?: boolean;
    force?: boolean;
    dryRun?: boolean;
}

export interface ProductSyncWarning {
    sourceProductId?: string;
    name?: string;
    code: string;
    message: string;
}

export interface ProductSyncChange {
    sourceProductId: string;
    name: string;
    action: "create" | "update" | "bind" | "deactivate" | "missing";
    fields?: string[];
}

export interface ProductSyncSummary {
    generatedAt: string;
    trigger: string;
    dryRun: boolean;
    skipped: boolean;
    skippedReason?: string;
    created: number;
    updated: number;
    bound: number;
    deactivated: number;
    missing: number;
    skippedProducts: number;
    changes: ProductSyncChange[];
    warnings: ProductSyncWarning[];
    durationMs: number;
}

export type ProductSyncOutcome =
    | { ok: true; data: ProductSyncSummary }
    | {
          ok: false;
          code: string;
          message: string;
          status: number;
          details?: unknown;
      };

class ProductSyncError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly status: number,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = "ProductSyncError";
    }
}

const SETTING_KEYS = {
    lastGeneratedAt: "advisor_product_sync_last_generated_at",
    lastTotal: "advisor_product_sync_last_total",
    lastResult: "advisor_product_sync_last_result",
    lastSuccessAt: "advisor_product_sync_last_success_at",
} as const;

const snapshotOptionsSchema = z
    .object({
        trigger: z.string().max(50).optional(),
        bindByName: z.boolean().optional(),
        force: z.boolean().optional(),
        dryRun: z.boolean().optional(),
    })
    .optional();

const envelopeSchema = z.object({
    schemaVersion: z.literal(1),
    generatedAt: z.string().datetime(),
    products: z.array(z.unknown()).max(2000),
    options: snapshotOptionsSchema,
});

const snapshotProductSchema = z.object({
    sourceProductId: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1),
    category: z.string().trim().min(1),
    price: z.union([z.string(), z.number()]),
    description: z.string().default(""),
    published: z.boolean(),
    updatedAt: z.string().datetime(),
    capacity: z.string().nullable().optional(),
    howToUse: z.string().nullable().optional(),
    origin: z.string().nullable().optional(),
    benefits: z.array(z.unknown()).optional(),
    images: z.array(z.unknown()).optional(),
    purchaseLinks: z.array(z.unknown()).optional(),
    purchaseLinksTotal: z.number().int().min(0).optional(),
});

type SnapshotProduct = z.infer<typeof snapshotProductSchema>;

let syncRunning = false;

export function normalizeProductName(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function normalizeProductPrice(value: unknown): string {
    const raw = String(value ?? "")
        .replace(/[^\d.-]/g, "")
        .trim();
    if (!raw) return String(value ?? "").trim().slice(0, MAX_PRICE_LENGTH);
    const num = Number(raw);
    if (Number.isFinite(num) && num >= 0) {
        return String(num).slice(0, MAX_PRICE_LENGTH);
    }
    return String(value ?? "").trim().slice(0, MAX_PRICE_LENGTH);
}

function trimOrNull(value: unknown, maxLength: number): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLength);
}

function warn(
    warnings: ProductSyncWarning[],
    code: string,
    message: string,
    item?: { sourceProductId?: string; name?: string }
): void {
    warnings.push({
        sourceProductId: item?.sourceProductId,
        name: item?.name,
        code,
        message,
    });
}

function isValidHttpUrl(value: string): boolean {
    if (!/^https?:\/\//i.test(value)) return false;
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

export function sanitizeProductImages(
    value: unknown,
    warnings: ProductSyncWarning[] = [],
    item?: { sourceProductId?: string; name?: string }
): string[] {
    if (!Array.isArray(value)) return [];
    const result: string[] = [];
    for (const raw of value) {
        if (typeof raw !== "string") {
            warn(warnings, "INVALID_IMAGE", "图片地址不是字符串，已跳过", item);
            continue;
        }
        const url = raw.trim();
        if (!url) continue;
        if (url.length > MAX_IMAGE_URL_LENGTH) {
            warn(warnings, "IMAGE_TOO_LONG", `图片地址超过 ${MAX_IMAGE_URL_LENGTH} 字符，已跳过`, item);
            continue;
        }
        if (!isValidHttpUrl(url)) {
            warn(warnings, "INVALID_IMAGE", `图片地址必须是绝对 http(s) URL，已跳过：${url.slice(0, 80)}`, item);
            continue;
        }
        if (!result.includes(url)) result.push(url);
        if (result.length >= MAX_IMAGE_COUNT) break;
    }
    if (Array.isArray(value) && value.length > MAX_IMAGE_COUNT) {
        warn(
            warnings,
            "IMAGE_TRUNCATED",
            `主站图片超过 ${MAX_IMAGE_COUNT} 张，仅同步前 ${MAX_IMAGE_COUNT} 张`,
            item
        );
    }
    return result;
}

export function sanitizeProductPurchaseLinks(
    value: unknown,
    warnings: ProductSyncWarning[] = [],
    item?: { sourceProductId?: string; name?: string }
): ProductPurchaseLink[] {
    if (!Array.isArray(value)) return [];
    const result: ProductPurchaseLink[] = [];
    const seen = new Set<string>();
    for (const raw of value) {
        if (!raw || typeof raw !== "object") {
            warn(warnings, "INVALID_PURCHASE_LINK", "购买链接不是对象，已跳过", item);
            continue;
        }
        const record = raw as Record<string, unknown>;
        const platformKey =
            typeof record.platformKey === "string" &&
            (PURCHASE_PLATFORM_KEYS as readonly string[]).includes(record.platformKey)
                ? (record.platformKey as PurchasePlatformKey)
                : null;
        if (!platformKey) {
            warn(
                warnings,
                "UNSUPPORTED_PURCHASE_PLATFORM",
                `子站不支持的购买平台，已跳过：${String(record.platform ?? record.platformKey ?? "")}`,
                item
            );
            continue;
        }
        if (seen.has(platformKey)) {
            warn(
                warnings,
                "DUPLICATE_PURCHASE_PLATFORM",
                `购买平台重复，已跳过：${PURCHASE_PLATFORM_LABELS[platformKey]}`,
                item
            );
            continue;
        }
        const url = trimOrNull(record.url, MAX_PURCHASE_URL_LENGTH);
        const shortLink = trimOrNull(
            record.miniProgramShortLink,
            MAX_MINI_PROGRAM_SHORT_LINK_LENGTH
        );
        const miniProgramPath = trimOrNull(
            record.miniProgramPath,
            MAX_MINI_PROGRAM_SHORT_LINK_LENGTH
        );
        const storeProductId = trimOrNull(
            record.storeProductId,
            MAX_STORE_PRODUCT_ID_LENGTH
        );
        if (url && !isValidHttpUrl(url)) {
            warn(
                warnings,
                "INVALID_PURCHASE_URL",
                `购买链接 URL 不合法，已跳过：${url.slice(0, 80)}`,
                item
            );
            continue;
        }
        if (!url && !shortLink) {
            warn(
                warnings,
                "EMPTY_PURCHASE_LINK",
                `购买平台 ${PURCHASE_PLATFORM_LABELS[platformKey]} 没有可用入口，已跳过`,
                item
            );
            continue;
        }
        if (platformKey === "wechat-shop" && !shortLink) {
            warn(
                warnings,
                "WECHAT_SHOP_WITHOUT_SHORT_LINK",
                "微信小店缺少小程序短链，已跳过",
                item
            );
            continue;
        }
        result.push({
            platformKey,
            platform:
                trimOrNull(record.platform, 50) ?? PURCHASE_PLATFORM_LABELS[platformKey],
            ...(url ? { url } : {}),
            ...(shortLink ? { miniProgramShortLink: shortLink } : {}),
            ...(miniProgramPath ? { miniProgramPath } : {}),
            ...(storeProductId ? { storeProductId } : {}),
        });
        seen.add(platformKey);
        if (result.length >= PURCHASE_PLATFORM_KEYS.length) break;
    }
    return result;
}

export function sanitizeProductBenefits(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const result: string[] = [];
    for (const raw of value) {
        if (typeof raw !== "string") continue;
        const text = raw.trim().slice(0, MAX_TAG_ITEM_LENGTH);
        if (!text) continue;
        if (!result.includes(text)) result.push(text);
        if (result.length >= MAX_TAG_ARRAY_LENGTH) break;
    }
    return result;
}

function canonicalizeJson(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalizeJson);
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return Object.keys(record)
            .sort()
            .reduce<Record<string, unknown>>((acc, key) => {
                acc[key] = canonicalizeJson(record[key]);
                return acc;
            }, {});
    }
    return value;
}

export function jsonEqual(a: unknown, b: unknown): boolean {
    return (
        JSON.stringify(canonicalizeJson(a ?? null)) ===
        JSON.stringify(canonicalizeJson(b ?? null))
    );
}

function readStringSetting(settings: Map<string, unknown>, key: string): string | null {
    const value = settings.get(key);
    return typeof value === "string" && value ? value : null;
}

function readNumberSetting(settings: Map<string, unknown>, key: string): number | null {
    const value = settings.get(key);
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function emptySummary(
    generatedAt: string,
    trigger: string,
    dryRun: boolean,
    startedAt: number,
    skippedReason: string
): ProductSyncSummary {
    return {
        generatedAt,
        trigger,
        dryRun,
        skipped: true,
        skippedReason,
        created: 0,
        updated: 0,
        bound: 0,
        deactivated: 0,
        missing: 0,
        skippedProducts: 0,
        changes: [],
        warnings: [],
        durationMs: Date.now() - startedAt,
    };
}

export async function syncProductsFromMain(input: unknown): Promise<ProductSyncOutcome> {
    if (process.env.PRODUCT_SYNC_ENABLED === "false") {
        return {
            ok: false,
            code: "SYNC_DISABLED",
            message: "产品同步已停用",
            status: 503,
        };
    }

    if (syncRunning) {
        return {
            ok: false,
            code: "SYNC_IN_PROGRESS",
            message: "产品同步正在进行中，请稍后重试",
            status: 409,
        };
    }

    syncRunning = true;
    const startedAt = Date.now();
    try {
        const parsed = envelopeSchema.safeParse(input);
        if (!parsed.success) {
            return {
                ok: false,
                code: "INVALID_SNAPSHOT",
                message: "产品快照结构不合法",
                status: 400,
                details: parsed.error.issues,
            };
        }

        const envelope = parsed.data;
        const options: ProductSyncOptions = envelope.options ?? {};
        const trigger = options.trigger ?? "push";
        const dryRun = options.dryRun === true;

        const summary = await prisma.$transaction(async (tx) => {
            const settingsRows = await tx.setting.findMany({
                where: {
                    key: {
                        in: [
                            SETTING_KEYS.lastGeneratedAt,
                            SETTING_KEYS.lastTotal,
                            SETTING_KEYS.lastResult,
                            SETTING_KEYS.lastSuccessAt,
                        ],
                    },
                },
                select: { key: true, value: true },
            });
            const settings = new Map<string, unknown>(
                settingsRows.map((row) => [row.key, row.value])
            );

            const lastGeneratedAt = readStringSetting(
                settings,
                SETTING_KEYS.lastGeneratedAt
            );
            if (
                lastGeneratedAt &&
                new Date(envelope.generatedAt).getTime() <
                    new Date(lastGeneratedAt).getTime()
            ) {
                return emptySummary(
                    envelope.generatedAt,
                    trigger,
                    dryRun,
                    startedAt,
                    "stale_snapshot"
                );
            }

            const rawCount = envelope.products.length;
            const lastTotal = readNumberSetting(settings, SETTING_KEYS.lastTotal);
            if (rawCount === 0 && options.force !== true) {
                throw new ProductSyncError(
                    "EMPTY_SNAPSHOT",
                    "产品快照为空，已拒绝同步（如确需清空请使用 force）",
                    409
                );
            }
            if (
                lastTotal !== null &&
                lastTotal > 0 &&
                rawCount < lastTotal / 2 &&
                options.force !== true
            ) {
                throw new ProductSyncError(
                    "SYNC_COUNT_DROP",
                    `产品数量从 ${lastTotal} 骤降到 ${rawCount}，已拒绝同步（如确需执行请使用 force）`,
                    409,
                    { lastTotal, rawCount }
                );
            }

            const rawIds = new Set<string>();
            for (const raw of envelope.products) {
                if (raw && typeof raw === "object") {
                    const id = (raw as Record<string, unknown>).sourceProductId;
                    if (typeof id === "string" && id.trim()) rawIds.add(id.trim());
                }
            }

            const allProducts = await tx.product.findMany();
            const bySourceId = new Map<string, (typeof allProducts)[number]>();
            for (const product of allProducts) {
                if (product.sourceProductId) bySourceId.set(product.sourceProductId, product);
            }
            const unboundByName = new Map<string, (typeof allProducts)[number]>();
            const duplicateUnboundNames = new Set<string>();
            for (const product of allProducts) {
                if (product.sourceProductId) continue;
                const key = normalizeProductName(product.name);
                if (!key) continue;
                if (duplicateUnboundNames.has(key)) continue;
                if (unboundByName.has(key)) {
                    // 同名多条时不自动绑定，避免误绑
                    unboundByName.delete(key);
                    duplicateUnboundNames.add(key);
                } else {
                    unboundByName.set(key, product);
                }
            }

            const warnings: ProductSyncWarning[] = [];
            const changes: ProductSyncChange[] = [];
            let created = 0;
            let updated = 0;
            let bound = 0;
            let deactivated = 0;
            let missing = 0;
            let skippedProducts = 0;
            const now = new Date();

            for (const raw of envelope.products) {
                const productParsed = snapshotProductSchema.safeParse(raw);
                if (!productParsed.success) {
                    skippedProducts += 1;
                    const record =
                        raw && typeof raw === "object"
                            ? (raw as Record<string, unknown>)
                            : {};
                    warn(
                        warnings,
                        "INVALID_PRODUCT",
                        productParsed.error.issues[0]?.message ?? "产品字段不合法",
                        {
                            sourceProductId:
                                typeof record.sourceProductId === "string"
                                    ? record.sourceProductId
                                    : undefined,
                            name:
                                typeof record.name === "string" ? record.name : undefined,
                        }
                    );
                    continue;
                }

                const item: SnapshotProduct = productParsed.data;
                const itemRef = {
                    sourceProductId: item.sourceProductId,
                    name: item.name,
                };
                const name = item.name.trim().slice(0, MAX_NAME_LENGTH);
                const category = item.category.trim().slice(0, MAX_CATEGORY_LENGTH);
                const price = normalizeProductPrice(item.price);
                const description = item.description
                    .trim()
                    .slice(0, MAX_DESCRIPTION_LENGTH);
                const capacity = trimOrNull(item.capacity, MAX_CAPACITY_LENGTH);
                const origin = trimOrNull(item.origin, MAX_ORIGIN_LENGTH);
                const howToUse = trimOrNull(item.howToUse, MAX_HOW_TO_USE_LENGTH);
                const images = sanitizeProductImages(item.images, warnings, itemRef);
                const purchaseLinksTotal =
                    item.purchaseLinksTotal ??
                    (Array.isArray(item.purchaseLinks) ? item.purchaseLinks.length : 0);
                const purchaseLinks = sanitizeProductPurchaseLinks(
                    item.purchaseLinks,
                    warnings,
                    itemRef
                );
                const affiliateLinks = buildAffiliateLinks(purchaseLinks);
                const benefits = sanitizeProductBenefits(item.benefits);
                const sourceUpdatedAt = new Date(item.updatedAt);

                if (
                    purchaseLinksTotal > purchaseLinks.length &&
                    purchaseLinks.length > 0
                ) {
                    warn(
                        warnings,
                        "PURCHASE_LINKS_FILTERED",
                        `有 ${purchaseLinksTotal - purchaseLinks.length} 条购买链接因子站不支持或格式不合法被跳过`,
                        itemRef
                    );
                }

                let existing = bySourceId.get(item.sourceProductId) ?? null;
                let justBound = false;

                if (!existing && options.bindByName === true) {
                    const candidate = unboundByName.get(normalizeProductName(name));
                    if (candidate) {
                        existing = candidate;
                        justBound = true;
                        unboundByName.delete(normalizeProductName(name));
                    }
                }

                if (
                    !existing &&
                    duplicateUnboundNames.has(normalizeProductName(name))
                ) {
                    skippedProducts += 1;
                    warn(
                        warnings,
                        "AMBIGUOUS_NAME_BIND",
                        "子站存在多条同名未绑定产品，已跳过，请人工确认绑定",
                        itemRef
                    );
                    continue;
                }

                if (!existing && options.bindByName !== true) {
                    const candidate = unboundByName.get(normalizeProductName(name));
                    if (candidate) {
                        skippedProducts += 1;
                        warn(
                            warnings,
                            "UNBOUND_NAME_MATCH",
                            "子站存在同名未绑定产品，已跳过创建以避免重复；请先执行初始绑定",
                            itemRef
                        );
                        continue;
                    }
                }

                if (existing) {
                    if (!item.published) {
                        const update: Prisma.ProductUpdateInput = {};
                        const changedFields: string[] = [];
                        if (existing.active) {
                            update.active = false;
                            changedFields.push("active");
                        }
                        if (existing.sourceProductId !== item.sourceProductId) {
                            update.sourceProductId = item.sourceProductId;
                        }
                        if (existing.sourceMissingAt !== null) {
                            update.sourceMissingAt = null;
                        }
                        if (justBound) {
                            update.sourceUpdatedAt = sourceUpdatedAt;
                            update.sourceSyncedAt = now;
                        }
                        if (Object.keys(update).length > 0) {
                            if (!dryRun) {
                                await tx.product.update({ where: { id: existing.id }, data: update });
                            }
                            if (changedFields.length > 0) deactivated += 1;
                            if (justBound) bound += 1;
                            changes.push({
                                sourceProductId: item.sourceProductId,
                                name,
                                action: justBound ? "bind" : "deactivate",
                                fields: changedFields,
                            });
                        }
                        continue;
                    }

                    const update: Prisma.ProductUpdateInput = {};
                    const changedFields: string[] = [];
                    const set = (field: string, value: unknown) => {
                        (update as Record<string, unknown>)[field] = value;
                        changedFields.push(field);
                    };

                    if (dryRun && !jsonEqual(existing.benefits, benefits)) {
                        warn(
                            warnings,
                            "BENEFITS_DIFFER",
                            "主站与子站主要功效不一致（当前保留子站值，确认后可决定是否同步）",
                            itemRef
                        );
                    }

                    if (existing.name !== name) set("name", name);
                    if (existing.category !== category) set("category", category);
                    if (existing.price !== price) set("price", price);
                    if (description && existing.description !== description) {
                        set("description", description);
                    } else if (!description) {
                        warn(
                            warnings,
                            "EMPTY_DESCRIPTION",
                            "主站产品描述为空，已保留子站原描述",
                            itemRef
                        );
                    }
                    if (capacity && existing.capacity !== capacity) {
                        set("capacity", capacity);
                    }
                    if (origin && existing.origin !== origin) set("origin", origin);
                    if (howToUse && existing.howToUse !== howToUse) {
                        set("howToUse", howToUse);
                    }
                    if (images.length > 0) {
                        if (!jsonEqual(existing.images, images) || existing.image !== images[0]) {
                            set("images", images as unknown as Prisma.InputJsonValue);
                            set("image", images[0]);
                        }
                    } else {
                        warn(
                            warnings,
                            "NO_IMAGES",
                            "主站产品没有可用图片，已保留子站原图片",
                            itemRef
                        );
                    }
                    if (purchaseLinksTotal === 0) {
                        if (existing.purchaseLinks !== null) {
                            set("purchaseLinks", Prisma.DbNull);
                            set("affiliateLinks", Prisma.DbNull);
                        }
                    } else if (purchaseLinks.length > 0) {
                        if (!jsonEqual(existing.purchaseLinks, purchaseLinks)) {
                            set(
                                "purchaseLinks",
                                purchaseLinks as unknown as Prisma.InputJsonValue
                            );
                            set(
                                "affiliateLinks",
                                (affiliateLinks ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue
                            );
                        }
                    } else {
                        warn(
                            warnings,
                            "NO_SUPPORTED_PURCHASE_LINKS",
                            "主站购买链接都不在子站支持平台内，已保留子站原购买链接",
                            itemRef
                        );
                    }

                    if (justBound || existing.sourceProductId !== item.sourceProductId) {
                        set("sourceProductId", item.sourceProductId);
                    }
                    if (existing.sourceMissingAt !== null) {
                        set("sourceMissingAt", null);
                    }

                    if (changedFields.length > 0) {
                        const contentChanged = changedFields.some(
                            (field) =>
                                field !== "sourceProductId" && field !== "sourceMissingAt"
                        );
                        update.sourceUpdatedAt = sourceUpdatedAt;
                        update.sourceSyncedAt = now;
                        if (!dryRun) {
                            await tx.product.update({ where: { id: existing.id }, data: update });
                        }
                        if (contentChanged) updated += 1;
                        if (justBound) bound += 1;
                        changes.push({
                            sourceProductId: item.sourceProductId,
                            name,
                            action: justBound ? "bind" : "update",
                            fields: changedFields,
                        });
                    } else if (justBound) {
                        if (!dryRun) {
                            await tx.product.update({
                                where: { id: existing.id },
                                data: {
                                    sourceProductId: item.sourceProductId,
                                    sourceUpdatedAt,
                                    sourceSyncedAt: now,
                                    sourceMissingAt: null,
                                },
                            });
                        }
                        bound += 1;
                        changes.push({
                            sourceProductId: item.sourceProductId,
                            name,
                            action: "bind",
                            fields: [],
                        });
                    } else if (existing.sourceMissingAt !== null) {
                        if (!dryRun) {
                            await tx.product.update({
                                where: { id: existing.id },
                                data: { sourceMissingAt: null },
                            });
                        }
                        changes.push({
                            sourceProductId: item.sourceProductId,
                            name,
                            action: "update",
                            fields: ["sourceMissingAt"],
                        });
                    }
                    continue;
                }

                // 新主站产品：只创建已发布产品，默认停用，等待配置推荐属性
                if (!item.published) {
                    skippedProducts += 1;
                    continue;
                }
                if (!description) {
                    skippedProducts += 1;
                    warn(
                        warnings,
                        "NO_DESCRIPTION",
                        "主站产品描述为空，已跳过创建",
                        itemRef
                    );
                    continue;
                }
                if (images.length === 0) {
                    skippedProducts += 1;
                    warn(warnings, "NO_IMAGES", "主站产品没有可用图片，已跳过创建", itemRef);
                    continue;
                }

                const createData: Prisma.ProductCreateInput = {
                    name,
                    category,
                    price,
                    description,
                    image: images[0],
                    images: images as unknown as Prisma.InputJsonValue,
                    capacity,
                    origin,
                    howToUse,
                    benefits: benefits as unknown as Prisma.InputJsonValue,
                    keyIngredients: [],
                    suitableSkinTypes: [],
                    negativeFor: [],
                    active: false,
                    featured: false,
                    sourceProductId: item.sourceProductId,
                    sourceUpdatedAt,
                    sourceSyncedAt: now,
                    ...(purchaseLinks.length > 0
                        ? {
                              purchaseLinks:
                                  purchaseLinks as unknown as Prisma.InputJsonValue,
                              affiliateLinks:
                                  (affiliateLinks ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
                          }
                        : {}),
                };

                if (!dryRun) {
                    await tx.product.create({ data: createData });
                }
                created += 1;
                changes.push({
                    sourceProductId: item.sourceProductId,
                    name,
                    action: "create",
                    fields: ["active=false", "featured=false", "推荐字段待配置"],
                });
            }

            // 主站已删除/快照中缺失：只停用，不物理删除
            for (const product of allProducts) {
                if (!product.sourceProductId) continue;
                if (rawIds.has(product.sourceProductId)) continue;
                if (!product.active && product.sourceMissingAt) continue;
                if (!dryRun) {
                    await tx.product.update({
                        where: { id: product.id },
                        data: { active: false, sourceMissingAt: now },
                    });
                }
                missing += 1;
                if (product.active) deactivated += 1;
                changes.push({
                    sourceProductId: product.sourceProductId,
                    name: product.name,
                    action: "missing",
                    fields: ["active=false"],
                });
            }

            const summary: ProductSyncSummary = {
                generatedAt: envelope.generatedAt,
                trigger,
                dryRun,
                skipped: false,
                created,
                updated,
                bound,
                deactivated,
                missing,
                skippedProducts,
                changes,
                warnings,
                durationMs: Date.now() - startedAt,
            };

            if (!dryRun) {
                const resultValue = {
                    trigger,
                    created,
                    updated,
                    bound,
                    deactivated,
                    missing,
                    skippedProducts,
                    warnings: warnings.slice(0, 20),
                    durationMs: summary.durationMs,
                    at: now.toISOString(),
                } as unknown as Prisma.InputJsonValue;

                await tx.setting.upsert({
                    where: { key: SETTING_KEYS.lastGeneratedAt },
                    create: { key: SETTING_KEYS.lastGeneratedAt, value: envelope.generatedAt },
                    update: { value: envelope.generatedAt },
                });
                await tx.setting.upsert({
                    where: { key: SETTING_KEYS.lastTotal },
                    create: { key: SETTING_KEYS.lastTotal, value: rawCount },
                    update: { value: rawCount },
                });
                await tx.setting.upsert({
                    where: { key: SETTING_KEYS.lastSuccessAt },
                    create: { key: SETTING_KEYS.lastSuccessAt, value: now.toISOString() },
                    update: { value: now.toISOString() },
                });
                await tx.setting.upsert({
                    where: { key: SETTING_KEYS.lastResult },
                    create: { key: SETTING_KEYS.lastResult, value: resultValue },
                    update: { value: resultValue },
                });
            }

            return summary;
        });

        logger.info("[ProductSync] completed", {
            trigger: summary.trigger,
            dryRun: summary.dryRun,
            skipped: summary.skipped,
            created: summary.created,
            updated: summary.updated,
            bound: summary.bound,
            deactivated: summary.deactivated,
            missing: summary.missing,
            warnings: summary.warnings.length,
            durationMs: summary.durationMs,
        });

        return { ok: true, data: summary };
    } catch (error) {
        if (error instanceof ProductSyncError) {
            logger.warn("[ProductSync] blocked", {
                code: error.code,
                message: error.message,
                details: error.details,
            });
            return {
                ok: false,
                code: error.code,
                message: error.message,
                status: error.status,
                details: error.details,
            };
        }
        logger.error("[ProductSync] failed", { error: String(error) });
        return {
            ok: false,
            code: "INTERNAL_ERROR",
            message: "产品同步失败",
            status: 500,
        };
    } finally {
        syncRunning = false;
    }
}

/** 仅测试用：重置进程内同步锁 */
export function __resetProductSyncLockForTests(): void {
    syncRunning = false;
}
