import {
    PURCHASE_PLATFORM_LABELS,
    PURCHASE_PLATFORM_KEYS,
    type PurchasePlatformKey,
} from "@/lib/purchase-platforms";

export interface ProductPurchaseLink {
    platformKey: PurchasePlatformKey;
    platform: string;
    url?: string;
    miniProgramShortLink?: string;
    miniProgramPath?: string;
    storeProductId?: string;
}

function isPurchasePlatformKey(value: unknown): value is PurchasePlatformKey {
    return (
        typeof value === "string" &&
        (PURCHASE_PLATFORM_KEYS as readonly string[]).includes(value)
    );
}

function trimOrUndefined(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}

/** 只接受 http(s) URL，避免历史/异常 JSON 把 javascript: 等协议带到 H5。 */
function trimHttpUrl(value: unknown): string | undefined {
    const trimmed = trimOrUndefined(value);
    if (!trimmed) return undefined;
    try {
        const url = new URL(trimmed);
        return url.protocol === "http:" || url.protocol === "https:" ? trimmed : undefined;
    } catch {
        return undefined;
    }
}

/**
 * 兼容读取：
 * - 新结构 purchaseLinks（优先）
 * - 旧结构 affiliateLinks（taobao/xiaohongshu/douyin），仅补齐新结构缺失的渠道/URL
 */
export function normalizeProductPurchaseLinks(
    purchaseLinks: unknown,
    affiliateLinks: unknown
): ProductPurchaseLink[] {
    const result: ProductPurchaseLink[] = [];
    const byPlatform = new Map<PurchasePlatformKey, ProductPurchaseLink>();

    if (Array.isArray(purchaseLinks)) {
        for (const item of purchaseLinks) {
            if (!item || typeof item !== "object") continue;
            const record = item as Record<string, unknown>;
            if (!isPurchasePlatformKey(record.platformKey)) continue;
            if (byPlatform.has(record.platformKey)) continue;
            const link: ProductPurchaseLink = {
                platformKey: record.platformKey,
                platform:
                    trimOrUndefined(record.platform) ??
                    PURCHASE_PLATFORM_LABELS[record.platformKey],
                url: trimHttpUrl(record.url),
                miniProgramShortLink: trimOrUndefined(record.miniProgramShortLink),
                miniProgramPath: trimOrUndefined(record.miniProgramPath),
                storeProductId: trimOrUndefined(record.storeProductId),
            };
            byPlatform.set(record.platformKey, link);
            result.push(link);
        }
    }

    if (affiliateLinks && typeof affiliateLinks === "object" && !Array.isArray(affiliateLinks)) {
        const links = affiliateLinks as Record<string, unknown>;
        const legacy: Array<{ key: string; platformKey: PurchasePlatformKey }> = [
            { key: "taobao", platformKey: "tmall" },
            { key: "xiaohongshu", platformKey: "xiaohongshu" },
            { key: "douyin", platformKey: "douyin" },
        ];
        for (const { key, platformKey } of legacy) {
            const url = trimHttpUrl(links[key]);
            if (!url) continue;
            const existing = byPlatform.get(platformKey);
            if (existing) {
                if (!existing.url) existing.url = url;
                continue;
            }
            const link: ProductPurchaseLink = {
                platformKey,
                platform: PURCHASE_PLATFORM_LABELS[platformKey],
                url,
            };
            byPlatform.set(platformKey, link);
            result.push(link);
        }
    }

    return result;
}

/** 从新结构派生旧 affiliateLinks，保证旧客户端兼容 */
export function buildAffiliateLinks(
    purchaseLinks: ProductPurchaseLink[]
): Record<string, string> | null {
    const result: Record<string, string> = {};
    for (const link of purchaseLinks) {
        const url = trimHttpUrl(link.url);
        if (!url) continue;
        if (link.platformKey === "tmall") result.taobao = url;
        if (link.platformKey === "xiaohongshu") result.xiaohongshu = url;
        if (link.platformKey === "douyin") result.douyin = url;
    }
    return Object.keys(result).length > 0 ? result : null;
}


