import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionSignature, ADMIN_SESSION_COOKIE_NAME } from "@/lib/session-verify";
import { verifyCsrfToken } from "@/lib/csrf";

/**
 * Next.js 全局 Middleware
 * 部署环境：云服务器（PM2 单实例常驻进程）
 * 注意：此 middleware 在 Edge Runtime 中运行，不使用 Node.js 原生 API
 */

// 敏感路径前缀列表（需要额外安全检查）
const SENSITIVE_PATHS = ["/api/admin", "/api/cron"];

// AI 端点列表（高价值目标，需严格防护）
const AI_ENDPOINTS = ["/api/advisor/analyze", "/api/advisor/face-analyze"];

// 管理员区域公开路径（无需 session 检查）
const ADMIN_PUBLIC_PATHS = [
    "/admin/login",
    "/api/admin/auth/login",
    "/api/admin/setup",
    "/api/admin/cleanup-guests", // 支持 ADMIN_SECRET Bearer token（定时任务）
];

// 允许的源（生产环境限制为实际域名，开发环境放行 localhost）
const ALLOWED_ORIGINS = [
    process.env.NEXT_PUBLIC_SITE_URL || "",
    process.env.NEXT_PUBLIC_BASE_URL || "",
    // 本地开发自动放行
    ...(process.env.NODE_ENV !== "production" ? ["http://localhost:3000", "http://127.0.0.1:3000"] : []),
].filter(Boolean);

// 演示模式：DISABLE_CSRF=true 时跳过所有 CSRF 检查（Origin + Token）
const DISABLE_CSRF = process.env.DISABLE_CSRF === "true";

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const response = NextResponse.next();

    // ==================== CORS 全局配置 ====================
    const origin = request.headers.get("origin");
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        response.headers.set("Access-Control-Allow-Origin", origin);
        response.headers.set("Access-Control-Allow-Credentials", "true");
        response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Setup-Secret, X-CSRF-Token");
    }

    // 预检请求直接返回
    if (request.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers: response.headers });
    }

    // ==================== Admin 区域鉴权 ====================
    const isAdminPage = pathname.startsWith("/admin");
    const isAdminApi = pathname.startsWith("/api/admin");
    if ((isAdminPage || isAdminApi) && !ADMIN_PUBLIC_PATHS.some((p) => pathname === p)) {
        const adminSession = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
        const sessionData = adminSession
            ? await verifySessionSignature(adminSession)
            : null;
        const isValid = sessionData?.adminId != null;

        if (!isValid) {
            if (isAdminApi) {
                return NextResponse.json(
                    { success: false, error: "Unauthorized" },
                    { status: 401 }
                );
            }
            // Admin page — redirect to login
            return NextResponse.redirect(new URL("/admin/login", request.url));
        }
    }

    // ==================== Admin API CSRF 防护 ====================
    if (!DISABLE_CSRF && isAdminApi && !ADMIN_PUBLIC_PATHS.some((p) => pathname === p)) {
        const unsafeMethods = ["POST", "PUT", "PATCH", "DELETE"];
        if (unsafeMethods.includes(request.method)) {
            const reqOrigin = request.headers.get("origin");
            const referer = request.headers.get("referer");
            const isSameOrigin =
                (reqOrigin && ALLOWED_ORIGINS.some((o) => o && reqOrigin.startsWith(o))) ||
                (referer && ALLOWED_ORIGINS.some((o) => o && referer.startsWith(o)));

            if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS[0] && !isSameOrigin) {
                return NextResponse.json(
                    { error: "Forbidden: cross-origin mutations not allowed" },
                    { status: 403 }
                );
            }
        }
    }

    // ==================== C 端 API CSRF 防护 ====================
    if (!DISABLE_CSRF) {
    const csrfExemptPaths = [
        // 公开认证接口
        "/api/auth/login",
        "/api/auth/login-code",
        "/api/auth/register",
        "/api/auth/send-code",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/api/auth/wechat",
        "/api/auth/wechat/bind",
        "/api/auth/refresh",
        // 匿名/埋点接口：sendBeacon 无法携带自定义 header
        "/api/advisor/analytics/track",
    ];
    const isCApi = pathname.startsWith("/api/") && !isAdminApi && !csrfExemptPaths.some((p) => pathname === p);
    if (isCApi) {
        const csrfValid = await verifyCsrfToken(request);
        if (!csrfValid) {
            return NextResponse.json(
                { error: "Forbidden: CSRF token missing or invalid" },
                { status: 403 }
            );
        }
    }
    }

    // ==================== AI 端点额外防护 ====================
    const isAiEndpoint = AI_ENDPOINTS.some((p) => pathname === p);
    if (isAiEndpoint) {
        // 1. 仅允许 POST 方法
        if (request.method !== "POST") {
            return NextResponse.json(
                { error: "Method Not Allowed" },
                { status: 405 }
            );
        }

        // 2. 检查 Origin / Referer（防止跨站请求）
        const reqOrigin = request.headers.get("origin");
        const referer = request.headers.get("referer");
        const isSameOrigin =
            (reqOrigin && ALLOWED_ORIGINS.some((o) => o && reqOrigin.startsWith(o))) ||
            (referer && ALLOWED_ORIGINS.some((o) => o && referer.startsWith(o)));

        // 如果配置了 ALLOWED_ORIGINS 但请求不带 Origin/Referer 或不匹配，拒绝
        if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS[0] && !isSameOrigin) {
            return NextResponse.json(
                { error: "Forbidden: cross-origin requests not allowed" },
                { status: 403 }
            );
        }

        // 3. 要求 Content-Type 为 application/json
        const contentType = request.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            return NextResponse.json(
                { error: "Unsupported Media Type" },
                { status: 415 }
            );
        }
    }

    // ==================== 敏感路径额外防护 ====================
    const isSensitive = SENSITIVE_PATHS.some((p) => pathname.startsWith(p));
    if (isSensitive) {
        // 1. 禁止直接从公网 IP 访问（如果配置了内部代理，可通过 X-Real-IP 判断）
        const forwardedFor = request.headers.get("x-forwarded-for");
        // 如果未经过反向代理（没有 X-Forwarded-For），且不是本地开发环境，则额外记录
        if (!forwardedFor && process.env.NODE_ENV === "production") {
            // 不阻止，但可在此处增加 IP 白名单逻辑
        }

        // 2. Cron 路径强制要求 Authorization Header
        if (pathname.startsWith("/api/cron")) {
            const authHeader = request.headers.get("authorization");
            const cronSecret = process.env.CRON_SECRET;
            // 未配置 CRON_SECRET 时直接拒绝，避免路径被公开访问
            if (!cronSecret) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            if (authHeader !== `Bearer ${cronSecret}` && request.nextUrl.searchParams.get("secret") !== cronSecret) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }
    }

    // ==================== 安全响应头（兜底）====================
    // 如果 next.config.ts 中的 headers 未生效，此处作为兜底
    if (process.env.NODE_ENV === "production" && !response.headers.has("Strict-Transport-Security")) {
        response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    }
    if (!response.headers.has("X-Content-Type-Options")) {
        response.headers.set("X-Content-Type-Options", "nosniff");
    }
    if (!response.headers.has("X-Frame-Options")) {
        response.headers.set("X-Frame-Options", "DENY");
    }
    if (!response.headers.has("Referrer-Policy")) {
        response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    }
    if (!response.headers.has("Content-Security-Policy")) {
        response.headers.set(
            "Content-Security-Policy",
            [
                "default-src 'self'",
                "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' blob: data: https://images.unsplash.com https://wp-cdn.4ce.cn https://*.alicdn.com https://*.aliyuncs.com https://*.qpic.cn https://*.myqcloud.com https://*.jd.com https://*.tmall.com https://*.taobao.com https://*.xiaohongshu.com https://*.douyincdn.com https://*.bilibili.com https://*.cdninstagram.com",
                "font-src 'self'",
                "connect-src 'self' data: https://*.aliyuncs.com https://wp-cdn.4ce.cn https://images.unsplash.com https://static.cloudflareinsights.com",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
            ].join("; ")
        );
    }

    // ==================== 缓存控制 ====================
    // 静态资源长期缓存
    if (
        pathname.match(/\.(jpg|jpeg|png|webp|avif|gif|svg|ico|woff2?|ttf|eot|css)$/) ||
        pathname.startsWith("/_next/static/") ||
        pathname.startsWith("/fonts/") ||
        pathname.startsWith("/images/") ||
        pathname.startsWith("/models/")
    ) {
        response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    }

    // API 路由不缓存
    if (pathname.startsWith("/api/") && !response.headers.has("Cache-Control")) {
        response.headers.set("Cache-Control", "no-store, private");
    }

    // 公共内容页允许 CDN 短期缓存（不含 admin 和 api）
    if (
        !pathname.startsWith("/api/") &&
        !pathname.startsWith("/admin/") &&
        !pathname.startsWith("/_next/") &&
        !pathname.match(/\.\w+$/) &&
        !response.headers.has("Cache-Control")
    ) {
        response.headers.set(
            "Cache-Control",
            "public, max-age=300, s-maxage=600, stale-while-revalidate=86400"
        );
    }

    return response;
}

// 匹配所有路径（排除静态资源）
export const config = {
    matcher: [
        "/api/:path*",
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)",
    ],
};
