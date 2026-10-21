/**
 * 四渠道统一购买结构（与后台/小程序共用）。
 *
 * - 微信小店：H5 无购买入口，小程序优先用 shortLink，后续可升级 store-product；
 * - 天猫国际/小红书/抖音：H5 直接打开 url；小程序有 shortLink 时跳转，否则复制 url；
 * - 保留 affiliateLinks 仅用于兼容旧客户端/旧缓存。
 *
 * 此文件必须保持无 zod / 无服务端依赖，供客户端组件安全引用。
 */
export const PURCHASE_PLATFORM_KEYS = [
    "wechat-shop",
    "tmall",
    "xiaohongshu",
    "douyin",
] as const;

export type PurchasePlatformKey = (typeof PURCHASE_PLATFORM_KEYS)[number];

export const PURCHASE_PLATFORM_LABELS: Record<PurchasePlatformKey, string> = {
    "wechat-shop": "微信小店",
    tmall: "天猫国际",
    xiaohongshu: "小红书",
    douyin: "抖音",
};

export const PURCHASE_PLATFORM_OPTIONS = PURCHASE_PLATFORM_KEYS.map((value) => ({
    value,
    label: PURCHASE_PLATFORM_LABELS[value],
}));
