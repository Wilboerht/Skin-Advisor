/**
 * 电商平台链接配置与工具
 */

// 支持的电商平台
export type EcommercePlatform = 'taobao' | 'xiaohongshu' | 'douyin';

// 平台配置
export interface PlatformConfig {
    id: EcommercePlatform;
    name: string;
    icon: string;
    color: string;
    bgColor: string;
    urlPattern?: RegExp;
}

// 平台详情
export const ECOMMERCE_PLATFORMS: Record<EcommercePlatform, PlatformConfig> = {
    taobao: {
        id: 'taobao',
        name: '淘宝',
        icon: '🛒',
        color: '#FF5000',
        bgColor: '#FFF5F0'
    },
    xiaohongshu: {
        id: 'xiaohongshu',
        name: '小红书',
        icon: '📕',
        color: '#FE2C55',
        bgColor: '#FFF0F3'
    },
    douyin: {
        id: 'douyin',
        name: '抖音',
        icon: '🎵',
        color: '#000000',
        bgColor: '#F5F5F5'
    }
};

// 平台优先级顺序
export const PLATFORM_PRIORITY: EcommercePlatform[] = [
    'xiaohongshu',
    'douyin',
    'taobao',
];

export interface AffiliateLinks {
    taobao?: string;
    xiaohongshu?: string;
    douyin?: string;
}

/**
 * 获取产品的电商链接列表
 */
export function getProductLinks(affiliateLinks: AffiliateLinks | null | undefined): Array<{
    platform: EcommercePlatform;
    url: string;
    config: PlatformConfig;
}> {
    if (!affiliateLinks) return [];

    const links: Array<{
        platform: EcommercePlatform;
        url: string;
        config: PlatformConfig;
    }> = [];

    // 按优先级顺序添加
    PLATFORM_PRIORITY.forEach(platform => {
        const url = affiliateLinks[platform];
        if (url && url.trim()) {
            links.push({
                platform,
                url: url.trim(),
                config: ECOMMERCE_PLATFORMS[platform]
            });
        }
    });

    return links;
}

/**
 * 获取首选购买链接
 */
export function getPrimaryLink(affiliateLinks: AffiliateLinks | null | undefined): {
    platform: EcommercePlatform;
    url: string;
    config: PlatformConfig;
} | null {
    const links = getProductLinks(affiliateLinks);
    return links[0] || null;
}

/**
 * 检查是否有购买链接
 */
export function hasAffiliateLinks(affiliateLinks: AffiliateLinks | null | undefined): boolean {
    if (!affiliateLinks) return false;
    return PLATFORM_PRIORITY.some(platform => affiliateLinks[platform]?.trim());
}

/**
 * 生成带追踪参数的链接
 */
export function appendTrackingParams(url: string, params: {
    source?: string;
    campaign?: string;
    productId?: string;
}): string {
    try {
        const urlObj = new URL(url);
        if (params.source) urlObj.searchParams.set('utm_source', params.source);
        if (params.campaign) urlObj.searchParams.set('utm_campaign', params.campaign);
        if (params.productId) urlObj.searchParams.set('pid', params.productId);
        return urlObj.toString();
    } catch {
        // 如果 URL 无效，返回原始链接
        return url;
    }
}

/**
 * 打开购买链接（带追踪）
 */
export function openAffiliateLink(
    url: string,
    productId: string,
    platform: EcommercePlatform
): void {
    const trackedUrl = appendTrackingParams(url, {
        source: 'myskin_today',
        campaign: 'product_recommendation',
        productId
    });

    // 记录点击事件 (异步，不阻塞)
    fetch('/api/advisor/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event: 'affiliate_click',
            properties: {
                productId,
                platform,
                url: trackedUrl
            }
        })
    }).catch(() => {/* ignore */ });

    // 新窗口打开
    window.open(trackedUrl, '_blank', 'noopener,noreferrer');
}

/**
 * 获取平台深链接 (用于移动端唤起 App)
 */
export function getDeepLink(platform: EcommercePlatform, productUrl: string): string | null {
    // 这些深链接格式可能需要根据实际情况调整
    const deepLinkSchemes: Partial<Record<EcommercePlatform, string>> = {
        taobao: 'taobao://',
    };

    const scheme = deepLinkSchemes[platform];
    if (!scheme) return null;

    // 简单实现：尝试用 scheme 替换 https://
    // 实际项目中应该使用各平台的官方深链接格式
    return productUrl.replace(/^https?:\/\//, scheme);
}

/**
 * 检测是否在移动端
 */
export function isMobile(): boolean {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        window.navigator.userAgent
    );
}
