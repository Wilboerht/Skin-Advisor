/**
 * 内容安全策略（CSP）单一事实源。
 *
 * next.config.ts（全局 headers）与 src/proxy.ts（运行时兜底）共用本文件，
 * 避免两处策略漂移。生产环境不包含 'unsafe-eval'；开发环境保留以支持
 * Next HMR / React Refresh。
 */
export interface CspOptions {
    allowUnsafeEval?: boolean;
}

const IMG_SRC = [
    "'self'",
    "blob:",
    "data:",
    "https://nihplod.cn",
    "https://images.unsplash.com",
    "https://wp-cdn.4ce.cn",
    "https://*.alicdn.com",
    "https://*.aliyuncs.com",
    "https://*.qpic.cn",
    "https://*.myqcloud.com",
    "https://*.jd.com",
    "https://*.tmall.com",
    "https://*.taobao.com",
    "https://*.xiaohongshu.com",
    "https://*.douyincdn.com",
    "https://*.bilibili.com",
    "https://*.cdninstagram.com",
];

const CONNECT_SRC = [
    "'self'",
    "data:",
    "https://nihplod.cn",
    "https://*.aliyuncs.com",
    "https://wp-cdn.4ce.cn",
    "https://images.unsplash.com",
    "https://static.cloudflareinsights.com",
    "https://www.googletagmanager.com",
    "https://hm.baidu.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://www.google.com",
];

export function buildContentSecurityPolicy(options: CspOptions = {}): string {
    const scriptSrc = [
        "'self'",
        ...(options.allowUnsafeEval ? ["'unsafe-eval'"] : []),
        "'unsafe-inline'",
        "https://static.cloudflareinsights.com",
        "https://www.googletagmanager.com",
        "https://hm.baidu.com",
    ];

    return [
        "default-src 'self'",
        `script-src ${scriptSrc.join(" ")}`,
        "style-src 'self' 'unsafe-inline'",
        `img-src ${IMG_SRC.join(" ")}`,
        "font-src 'self'",
        `connect-src ${CONNECT_SRC.join(" ")}`,
        "manifest-src 'self' https://nihplod.cn",
        "frame-src 'self' https://nihplod.cn",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self' https://nihplod.cn",
    ].join("; ");
}
